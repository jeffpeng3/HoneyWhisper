import { MicVAD } from "@ricky0123/vad-web";
import { LocalASR } from "./pipeline/ASR/LocalASR.js";
import { RemoteASR } from "./pipeline/ASR/RemoteASR.js";
import { GoogleTranslator } from "./pipeline/Translation/GoogleTranslator.js";
import { BaseTranslator } from "./pipeline/Translation/BaseTranslator.js";
import { BaseASR } from "./pipeline/ASR/BaseASR.js";

console.log("HoneyWhisper Offscreen Script Loaded (Pipeline Architecture)");

// Global State
let processing = false;
let stream = null;
let currentLanguage = 'en';
let vadInstance = null;
let audioContext = null;
let sourceNode = null;

// Pipeline Components
let asrService = null;
let translatorService = null;

// Current Configuration
let pipelineConfig = {
    asr: {
        type: 'webgpu', // 'webgpu', 'wasm', or 'remote'
        model_id: 'onnx-community/whisper-tiny',
        quantization: 'q4',
        // Remote config
        endpoint: '',
        key: ''
    },
    translation: {
        enabled: false,
        target: 'zh-TW'
    }
};

// --- Progress Reporting (Legacy/Compatible) ---
class MultiFileProgress {
    constructor() {
        this.files = {}; // { filename: { loaded: 0, total: 100, weight: 1 } }
        this.lastProgress = 0;
    }

    update(data) {
        if (data.status === 'initiate') {
            const isModel = data.file.endsWith('.onnx');
            const weight = isModel ? 100 : 1;
            this.files[data.file] = {
                progress: 0,
                weight: weight
            };
        } else if (data.status === 'progress') {
            if (!this.files[data.file]) {
                const isModel = data.file.endsWith('.onnx');
                this.files[data.file] = { progress: 0, weight: isModel ? 100 : 1 };
            }
            this.files[data.file].progress = data.progress || 0;
        } else if (data.status === 'done') {
            if (data.file) {
                // Individual file done
                if (this.files[data.file]) {
                    this.files[data.file].progress = 100;
                }
            } else {
                // All done
                this.lastProgress = 100;
                reportProgressRaw({ status: 'done', progress: 100 });
                return;
            }
        }

        const ESTIMATED_TOTAL_WEIGHT = 220;

        let currentWeightedSum = 0;
        for (const f of Object.values(this.files)) {
            currentWeightedSum += f.progress * f.weight;
        }

        let global = currentWeightedSum / ESTIMATED_TOTAL_WEIGHT;

        // Monotonic check
        if (global < this.lastProgress) global = this.lastProgress;

        // Clamp
        if (global > 99) global = 99;

        this.lastProgress = global;

        // Only report if significant change or initiate
        reportProgressRaw({
            status: 'progress',
            progress: global,
            file: data.file,
        });
    }

    reset() {
        this.files = {};
        this.lastProgress = 0;
    }
}

const progressTracker = new MultiFileProgress();

function reportProgressRaw(data) {
    chrome.runtime.sendMessage({
        type: 'MODEL_LOADING',
        target: 'popup',
        data
    }).catch(() => { });
}

function reportProgress(data) {
    // If 'done' with no file, it's global done
    if (data.status === 'done' && !data.file) {
        progressTracker.update(data); // Will trigger done
        progressTracker.reset(); // Reset for next run
    } else if (data.status === 'error') {
        reportProgressRaw(data);
    } else {
        progressTracker.update(data);
    }
}

// --- Pipeline Logic ---

async function initPipeline(config) {
    // 1. Initialize ASR
    let desiredType = config.asr.type;

    // Fallback heuristic if type isn't explicitly set but model_id implies remote
    if (config.asr.model_id === 'remote' || config.asr.model_id.startsWith('http')) {
        desiredType = 'remote';
    }
    // If it's explicitly set to wasm, use that
    if (config.asr.type === 'wasm') {
        desiredType = 'wasm';
    }

    const TargetClass = BaseASR.get(desiredType);
    if (!TargetClass) {
        throw new Error(`ASR Backend '${desiredType}' not found in registry`);
    }

    if (!asrService || !(asrService instanceof TargetClass)) {
        await releaseASR();
        asrService = BaseASR.create(desiredType);
    }

    // Load Model
    reportProgress({ status: 'initiate', name: 'Whisper', file: 'Initializing Pipeline...' });

    const device = desiredType === 'wasm' ? 'wasm' : 'webgpu';

    try {
        await asrService.load({
            model_id: config.asr.model_id,
            quantization: config.asr.quantization,
            endpoint: config.asr.endpoint,
            apiKey: config.asr.key,
            device: device,
            progress_callback: (data) => reportProgress(data)
        });
        reportProgress({ status: 'done' });
        console.log(`ASR Service Loaded: ${desiredType} (Device: ${device})`);
    } catch (err) {
        console.error("ASR Load Error:", err);
        reportProgress({ status: 'error', error: err.message });
        throw err;
    }

    // 2. Initialize Translator
    if (!translatorService) {
        translatorService = BaseTranslator.create('google');
    }
}

async function releaseASR() {
    if (asrService) {
        await asrService.release();
        asrService = null;
    }
}

// Generate Subtitles
async function generate(audio, isFinal = true) {
    if (processing) {
        console.warn("Processing busy, skipping...");
        return;
    }
    processing = true;

    try {
        if (!asrService) {
            throw new Error("Pipeline not initialized");
        }

        // 1. Transcribe
        const transcript = await asrService.transcribe(audio);
        let text = transcript.text;

        console.log(`Transcribed: "${text}"`);

        // 2. Translate
        if (text.length > 0 && pipelineConfig.translation.enabled) {
            // Source is currentLanguage (or auto), target is configured target
            try {
                const translated = await translatorService.translate(text, currentLanguage, pipelineConfig.translation.target);
                if (translated && translated !== text) {
                    console.log(`Translated: "${translated}"`);
                    text = `${text} (${translated})`;
                }
            } catch (translateErr) {
                console.warn("Translation failed:", translateErr);
            }
        }

        if (text.length > 0) {
            chrome.runtime.sendMessage({
                target: 'content',
                type: 'SUBTITLE_UPDATE',
                text: text,
                isFinal: isFinal
            }).catch((err) => { });
        }

    } catch (err) {
        console.error("Generation/Translation Error:", err);
    } finally {
        processing = false;
    }
}

// Start Recording
async function startRecording(streamId) {
    if (vadInstance) return;

    try {
        await initPipeline(pipelineConfig);

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        // Restore Audio
        if (!audioContext) {
            audioContext = new AudioContext();
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        if (sourceNode) {
            sourceNode.disconnect();
        }
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(audioContext.destination);

        vadInstance = await MicVAD.new({
            getStream: () => stream,
            baseAssetPath: chrome.runtime.getURL('assets/'),
            onnxWASMBasePath: chrome.runtime.getURL('assets/'),
            positiveSpeechThreshold: 0.8,
            negativeSpeechThreshold: 0.45,
            redemptionMs: 50,
            minSpeechMs: 100,
            model: 'v5',
            onSpeechStart: () => {
                console.log("VAD: Speech Start");
            },
            onSpeechEnd: (audio) => {
                const lenSec = audio.length / 16000;
                console.log(`VAD: Speech End (Length: ${lenSec.toFixed(2)}s)`);
                generate(audio, true);
            },
            onVADMisfire: () => {
                console.log("VAD: Misfire");
            }
        });

        vadInstance.start();
        console.log("VAD Started");
        chrome.runtime.sendMessage({ target: 'popup', type: 'RECORDING_STARTED' }).catch(() => { });

    } catch (err) {
        console.error("Error starting recording:", err);
        reportProgress({ status: 'error', error: err.message });
    }
}

function stopRecording() {
    processing = false;

    if (vadInstance) {
        vadInstance.pause();
        vadInstance = null;
    }

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }

    chrome.runtime.sendMessage({
        target: 'content',
        type: 'SUBTITLE_UPDATE',
        text: ''
    }).catch(() => { });

    releaseASR().catch(err => console.error("Error releasing pipeline:", err));
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.target === 'offscreen') {
            if (message.type === 'START_RECORDING') {
                const settings = message.settings || {};

                if (settings.language) currentLanguage = settings.language;
                else if (message.language) currentLanguage = message.language;

                // Update Config
                if (settings.model_id) pipelineConfig.asr.model_id = settings.model_id;
                else if (message.model_id) pipelineConfig.asr.model_id = message.model_id;

                if (settings.quantization) pipelineConfig.asr.quantization = settings.quantization;
                else if (message.quantization) pipelineConfig.asr.quantization = message.quantization;

                // New Settings
                if (settings.asrBackend) pipelineConfig.asr.type = settings.asrBackend;
                if (settings.remoteEndpoint) pipelineConfig.asr.endpoint = settings.remoteEndpoint;
                if (settings.remoteKey) pipelineConfig.asr.key = settings.remoteKey;

                if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
                if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;

                startRecording(message.data);
            } else if (message.type === 'STOP_RECORDING') {
                stopRecording();
            } else if (message.type === 'UPDATE_SETTINGS') {
                const settings = message.settings;
                if (settings) {
                    if (settings.language) currentLanguage = settings.language;

                    if (settings.model_id) pipelineConfig.asr.model_id = settings.model_id;
                    if (settings.quantization) pipelineConfig.asr.quantization = settings.quantization;

                    if (settings.asrBackend) pipelineConfig.asr.type = settings.asrBackend;
                    if (settings.remoteEndpoint) pipelineConfig.asr.endpoint = settings.remoteEndpoint;
                    if (settings.remoteKey) pipelineConfig.asr.key = settings.remoteKey;

                    if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
                    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
                }
            } else if (message.type === 'CLEAR_CACHE') {
                try {
                    const names = await caches.keys();
                    await Promise.all(names.map(name => caches.delete(name)));
                    console.log("Caches cleared:", names);
                } catch (err) {
                    console.error("Failed to clear cache:", err);
                }
            } else if (message.type === 'GET_CACHED_MODELS') {
                try {
                    const keys = await caches.keys();
                    const models = keys.filter(k => k.startsWith('transformers-cache-'));
                    chrome.runtime.sendMessage({
                        target: 'popup',
                        type: 'CACHED_MODELS_LIST',
                        models: models
                    });
                } catch (err) {
                    console.error("Failed to get cached models:", err);
                }
            }
        }
    })();
});
