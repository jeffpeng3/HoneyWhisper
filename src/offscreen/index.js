import {
    pipeline,
    env
} from "@huggingface/transformers";
import { MicVAD } from "@ricky0123/vad-web";

console.log("HoneyWhisper Offscreen Script Loaded");

// Configure local environment for Extensions
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/');
env.backends.onnx.logLevel = 'error';

const MAX_NEW_TOKENS = 64;

// Singleton Whisper Model Class
class AutomaticSpeechRecognitionPipeline {
    static model_id = 'onnx-community/whisper-tiny';
    static quantization = 'q4';
    static transcriber = null;

    static async getInstance(progress_callback = null) {
        this.transcriber ??= await pipeline(
            "automatic-speech-recognition",
            this.model_id,
            {
                dtype: this.quantization,
                device: "webgpu",
                progress_callback,
            }
        );
        return this.transcriber;
    }

    static async reset(new_model_id, new_quantization = 'q4') {
        this.model_id = new_model_id;
        this.quantization = new_quantization;
        await this.release();
    }

    static async release() {
        if (this.transcriber) {
            console.log("Releasing pipeline resources...");
            if (this.transcriber && this.transcriber.dispose) {
                await this.transcriber.dispose();
            }
            this.transcriber = null;
        }
    }
}

// Global State
let processing = false;
let stream = null;
let currentLanguage = 'en';
let vadInstance = null;
let audioContext = null;
let sourceNode = null;

// Progress Reporting
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

        // Calculate Global Progress
        // Estimate total weight: Assume at least 1 model file (100) + 5 config files (5) = 105
        // If we see more model files, we add them to the denominator dynamically if needed, 
        // but that causes regression.
        // Instead, we'll use a fixed large denominator that covers most cases (Encoder + Decoder = 200).
        // Let's assume 250 total weight units for 0-100%.
        // If it goes over, we clamp at 99% until 'done' fires.

        const ESTIMATED_TOTAL_WEIGHT = 220; // 2 models * 100 + 20 misc

        let currentWeightedSum = 0;
        for (const f of Object.values(this.files)) {
            currentWeightedSum += f.progress * f.weight; // (0-100) * weight
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
            file: data.file, // Pass through current file name
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

// Load Models
async function loadModels() {
    try {
        reportProgress({ status: 'initiate', name: 'Whisper', file: 'Initializing Pipeline...' });
        await AutomaticSpeechRecognitionPipeline.getInstance((data) => reportProgress(data));

        // Send global done signal
        reportProgress({ status: 'done' });
        console.log("Whisper Pipeline loaded");
    } catch (error) {
        console.error("Pipeline load error:", error);
        reportProgress({ status: 'error', error: error.message });
    }
}

// Generate Subtitles
async function generate(audio, isFinal = true) {
    if (processing) {
        console.warn("Processing busy, skipping...");
    }
    processing = true;

    try {
        const transcriber = await AutomaticSpeechRecognitionPipeline.getInstance();

        const generateOptions = {
            max_new_tokens: MAX_NEW_TOKENS,
            return_timestamps: false,
        };

        if (currentLanguage && currentLanguage !== 'auto') {
            generateOptions.language = currentLanguage;
        }

        const output = await transcriber(audio, generateOptions);
        const text = output.text.trim();

        console.log(`Generated: "${text}"`);

        if (text.length > 0) {
            chrome.runtime.sendMessage({
                target: 'content',
                type: 'SUBTITLE_UPDATE',
                text: text,
                isFinal: isFinal
            }).catch((err) => { });
        }

    } catch (err) {
        console.error("Generation Error:", err);
    } finally {
        processing = false;
    }
}

// Start Recording using vad-web
async function startRecording(streamId) {
    if (vadInstance) return;

    try {
        await loadModels();

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        // Restore Audio Playback (Route to speakers) & Optimize Lifecycle
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

    // Cleanup Audio Routing
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }

    chrome.runtime.sendMessage({
        target: 'content',
        type: 'SUBTITLE_UPDATE',
        text: ''
    }).catch(() => { });

    AutomaticSpeechRecognitionPipeline.release().catch(err => console.error("Error releasing pipeline:", err));
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.target === 'offscreen') {
            if (message.type === 'START_RECORDING') {
                if (message.language) {
                    currentLanguage = message.language;
                }
                const newModel = message.model_id;
                const newQuant = message.quantization || 'q4';

                if (newModel && (newModel !== AutomaticSpeechRecognitionPipeline.model_id || newQuant !== AutomaticSpeechRecognitionPipeline.quantization)) {
                    await AutomaticSpeechRecognitionPipeline.reset(newModel, newQuant);
                    await loadModels();
                }
                startRecording(message.data);
            } else if (message.type === 'STOP_RECORDING') {
                stopRecording();
            } else if (message.type === 'UPDATE_SETTINGS') {
                if (message.settings && message.settings.language) {
                    currentLanguage = message.settings.language;
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
                    // Filter for transformers cache
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

