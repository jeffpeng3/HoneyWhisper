import { MicVAD } from "@ricky0123/vad-web";
import { BaseTranslator } from "@/pipeline/Translation/BaseTranslator.js";
import { BaseASR } from "@/pipeline/ASR/BaseASR.js";
import "@/pipeline/registry_loader.js";
import { sendMessage, onMessage } from "$lib/messaging";
import { browser } from 'wxt/browser';

console.log("HoneyWhisper Offscreen Script Loaded (Pipeline Architecture)");

// Global State
let processing = false;
let stream = null;
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
        language: 'en', // Default language
        // Remote config
        endpoint: '',
        key: ''
    },
    translation: {
        enabled: false,
        service: 'google',
        target: 'zh-TW',
        showOriginal: true
    },
    vad: {
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.45,
        minSpeechMs: 100,
        redemptionMs: 50
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
    sendMessage('DOWNLOAD_PROGRESS', {
        progress: data.progress || 0,
        file: data.file || 'System',
        status: data.status,
        error: data.error
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

    if (config.asr.model_id.includes('k2')) {
        desiredType = 'k2';
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

    const device = config.asr.type === 'wasm' ? 'wasm' : 'webgpu';

    try {
        await asrService.load({
            model_id: config.asr.model_id,
            quantization: config.asr.quantization,
            endpoint: config.asr.endpoint,
            apiKey: config.asr.key,
            device: device,
            language: config.asr.language, // Use configured language
            progress_callback: (data) => reportProgress(data)
        });
        reportProgress({ status: 'done' });
        console.log(`ASR Service Loaded: ${desiredType} (Device: ${device}, Language: ${config.asr.language})`);
    } catch (err) {
        console.error("ASR Load Error:", err);
        reportProgress({ status: 'error', error: err.message });
        throw err;
    }

    // 2. Initialize Translator
    // Check if service changed or not initialized
    const targetService = config.translation.service;
    if (!translatorService || translatorService.constructor.name.toLowerCase() !== targetService) {
        translatorService = BaseTranslator.create(targetService);
        console.log(`Translator Initialized: ${targetService}`);
    }
}

async function releaseASR() {
    if (asrService) {
        await asrService.release();
        asrService = null;
    }
}

const MAX_QUEUE_SIZE = 5;
const audioQueue = [];

async function processAudio(audio, isFinal) {
    if (processing) return; // Should be handled by queue, but safety check
    processing = true;

    try {
        if (!asrService) {
            throw new Error("Pipeline not initialized");
        }

        // 1. Transcribe
        const transcript = await asrService.transcribe(audio);
        let text = transcript.text;


        console.log(`Transcribed: "${text}"`);

        // OPTIONAL: Send "Interim" update immediately if translation is enabled
        // This allows the user to see the original text while waiting for translation
        if (text.length > 0 && pipelineConfig.translation.enabled) {
            sendMessage('RESULT', {
                text: text,
                translatedText: null,
                isFinal: false // Mark as not final so it doesn't get added to history yet
            }).catch(() => { });
        }

        // 2. Translate
        let translatedText = null;
        if (text.length > 0 && pipelineConfig.translation.enabled) {
            // Source is pipelineConfig.asr.language (or auto), target is configured target
            try {
                const translated = await translatorService.translate(text, pipelineConfig.asr.language, pipelineConfig.translation.target);
                if (translated && translated !== text) {
                    console.log(`Translated: "${translated}"`);
                    translatedText = translated;
                }
            } catch (translateErr) {
                console.warn("Translation failed:", translateErr);
            }
        }

        // Apply "Show Original" logic
        if (translatedText && pipelineConfig.translation.enabled && pipelineConfig.translation.showOriginal === false) {
            // If we have a translation but "Show Original" is OFF:
            // Swap the text so the main 'text' becomes the translation,
            // and clear 'translatedText' so content.js treats it as a single line.
            text = translatedText;
            translatedText = null;
        }

        if (text.length > 0) {
            sendMessage('RESULT', {
                text: text,
                translatedText: translatedText,
                isFinal: isFinal
            }).catch(() => { });
        }

    } catch (err) {
        console.error("Generation/Translation Error:", err);
    } finally {
        processing = false;
        processQueue(); // Process next item
    }
}

async function processQueue() {
    if (processing) return;
    if (audioQueue.length === 0) return;

    const { audio, isFinal } = audioQueue.shift();
    await processAudio(audio, isFinal);
}

// Generate Subtitles (Entry Point)
async function generate(audio, isFinal = true) {
    if (audioQueue.length >= MAX_QUEUE_SIZE) {
        console.warn("Processing busy, queue full. Dropping request.");
        sendMessage('PERFORMANCE_WARNING', {
            message: 'System overload. Try smaller model.'
        }).catch(() => { });
        return;
    }

    audioQueue.push({ audio, isFinal });
    processQueue();
}

async function preloadVAD() {
    console.log("Preloading VAD assets...");
    const assets = [
        'silero_vad_v5.onnx',
        'vad.worklet.bundle.min.js'
    ];

    // We don't strictly need to report progress for these small files, 
    // but fetching them ensures they are in browser cache.
    for (const asset of assets) {
        try {
            const url = browser.runtime.getURL(`assets/${asset}`);
            await fetch(url);
        } catch (e) {
            console.warn(`[Preload] Failed to fetch ${asset}:`, e);
        }
    }
    console.log("VAD assets preloaded.");
}

// Start Recording
async function startRecording(streamId) {
    if (vadInstance) return;

    try {
        await initPipeline(pipelineConfig);
        await preloadVAD();

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
            baseAssetPath: browser.runtime.getURL('/'),
            onnxWASMBasePath: browser.runtime.getURL('/'),
            positiveSpeechThreshold: pipelineConfig.vad.positiveSpeechThreshold,
            negativeSpeechThreshold: pipelineConfig.vad.negativeSpeechThreshold,
            redemptionMs: pipelineConfig.vad.redemptionMs,
            minSpeechMs: pipelineConfig.vad.minSpeechMs,
            model: 'v5',
            onSpeechStart: () => {
                console.log("VAD: Speech Start");
                sendMessage('VAD_STATUS', { status: 'speech' }).catch(() => { });
            },
            onSpeechEnd: (audio) => {
                const lenSec = audio.length / 16000;
                console.log(`VAD: Speech End (Length: ${lenSec.toFixed(2)}s)`);
                sendMessage('VAD_STATUS', { status: 'quiet' }).catch(() => { });
                generate(audio, true);
            },
            onVADMisfire: () => {
                console.log("VAD: Misfire");
                sendMessage('VAD_STATUS', { status: 'idle' }).catch(() => { });
            }
        });

        vadInstance.start();
        console.log("VAD Started");
        console.log("VAD Started");
        // Broadcast to all (popup and background)
        sendMessage('RECORDING_STARTED', undefined).catch(() => { });

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

    sendMessage('CLEAR', undefined).catch(() => { });

    releaseASR().catch(err => console.error("Error releasing pipeline:", err));
}

onMessage('START_RECORDING', async (message) => {
    const settings = message.data.pipelineConfig || {};

    // Update Config
    if (settings.language) pipelineConfig.asr.language = settings.language;
    if (settings.model_id) pipelineConfig.asr.model_id = settings.model_id;
    if (settings.quantization) pipelineConfig.asr.quantization = settings.quantization;

    // New Settings
    if (settings.asrBackend) pipelineConfig.asr.type = settings.asrBackend;
    if (settings.remoteEndpoint) pipelineConfig.asr.endpoint = settings.remoteEndpoint;
    if (settings.remoteKey) pipelineConfig.asr.key = settings.remoteKey;

    if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
    if (settings.translationService) pipelineConfig.translation.service = settings.translationService;
    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
    if (typeof settings.showOriginal !== 'undefined') pipelineConfig.translation.showOriginal = settings.showOriginal;

    await startRecording(message.data.streamId);
});

onMessage('STOP_RECORDING', async () => {
    stopRecording();
});

onMessage('UPDATE_SETTINGS', async (message) => {
    const settings = message.data || {};

    if (settings.language) pipelineConfig.asr.language = settings.language;
    if (settings.model_id) pipelineConfig.asr.model_id = settings.model_id;
    if (settings.quantization) pipelineConfig.asr.quantization = settings.quantization;

    if (settings.asrBackend) pipelineConfig.asr.type = settings.asrBackend;
    if (settings.remoteEndpoint) pipelineConfig.asr.endpoint = settings.remoteEndpoint;
    if (settings.remoteKey) pipelineConfig.asr.key = settings.remoteKey;

    if (typeof settings.translationEnabled !== 'undefined') pipelineConfig.translation.enabled = settings.translationEnabled;
    if (settings.translationService) pipelineConfig.translation.service = settings.translationService;
    if (settings.targetLanguage) pipelineConfig.translation.target = settings.targetLanguage;
    if (typeof settings.showOriginal !== 'undefined') pipelineConfig.translation.showOriginal = settings.showOriginal;

    if (settings.vad) {
        pipelineConfig.vad = { ...pipelineConfig.vad, ...settings.vad };
    }
});


onMessage('DOWNLOAD_MODEL', async (message) => {
    // Download-only: fetch model files to cache without starting recording
    const settings = message.data.pipelineConfig || {};
    let desiredType = settings.asrBackend || 'webgpu';
    const modelId = settings.model_id || '';

    if (modelId.includes('k2')) {
        desiredType = 'k2';
    }

    try {
        const TargetClass = BaseASR.get(desiredType);
        if (!TargetClass) {
            throw new Error(`ASR Backend '${desiredType}' not found`);
        }

        const tempService = BaseASR.create(desiredType);
        const device = desiredType === 'wasm' ? 'wasm' : 'webgpu';

        reportProgress({ status: 'initiate', name: 'Download', file: 'Initializing Download...' });

        await tempService.download({
            model_id: modelId,
            quantization: settings.quantization || 'q4',
            device: device,
            language: settings.language || 'en',
            progress_callback: (data) => reportProgress(data)
        });

        reportProgress({ status: 'done' });
        console.log(`Model downloaded to cache: ${modelId}`);

        // Notify popup that download is complete
        sendMessage('DOWNLOAD_COMPLETE', undefined).catch(() => { });
    } catch (err) {
        console.error("Download Error:", err);
        reportProgress({ status: 'error', error: err.message });
    }
});
