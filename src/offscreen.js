import {
    AutoTokenizer,
    AutoProcessor,
    WhisperForConditionalGeneration,
    env
} from "@huggingface/transformers";
import { MicVAD } from "@ricky0123/vad-web";
import * as ort from "onnxruntime-web";

console.log("Offscreen Script Loaded - Version 5.0 (vad-web)");

// Configure local environment for Extensions
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');
env.backends.onnx.logLevel = 'error';

// Set onnx global for vad-web if needed, though it usually bundles its own reference or uses window.ort
// configuring ort for vad-web specifically might be needed if it can't find wasm.
// vad-web auto-detects.

const MAX_NEW_TOKENS = 64;

// Singleton Whisper Model Class
class AutomaticSpeechRecognitionPipeline {
    static model_id = 'onnx-community/whisper-tiny';
    static tokenizer = null;
    static processor = null;
    static model = null;

    static async getInstance(progress_callback = null) {
        this.tokenizer ??= AutoTokenizer.from_pretrained(this.model_id, {
            progress_callback,
        });
        this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
            progress_callback,
        });

        this.model ??= WhisperForConditionalGeneration.from_pretrained(
            this.model_id,
            {
                dtype: {
                    encoder_model: "q4",
                    decoder_model_merged: "q4",
                },
                device: "webgpu",
                progress_callback,
            },
        );

        return Promise.all([this.tokenizer, this.processor, this.model]);
    }

    static async reset(new_model_id) {
        this.model_id = new_model_id;
        this.tokenizer = null;
        this.processor = null;
        if (this.model) {
            console.log("Disposing old ONNX session...");
            if (this.model.dispose) {
                await this.model.dispose();
            }
        }
        this.model = null;
    }
}

// Global State
let processing = false;
let stream = null;
let currentLanguage = 'en';
let vadInstance = null;
let audioContext = null;

// Progress Reporting
function reportProgress(data) {
    chrome.runtime.sendMessage({
        type: 'MODEL_LOADING',
        target: 'popup',
        data
    }).catch(() => { });
}

// Load Models (Only Whisper now)
async function loadModels() {
    try {
        reportProgress({ status: 'initiate', name: 'Whisper', file: 'Initializing...' });

        await AutomaticSpeechRecognitionPipeline.getInstance((data) => reportProgress(data));

        reportProgress({ status: 'done', name: 'Whisper', file: 'Ready' });
        console.log("Whisper Model loaded");
    } catch (error) {
        console.error("Model load error:", error);
        reportProgress({ status: 'error', error: error.message });
    }
}

// Generate Subtitles
async function generate(audio, isFinal = true) {
    if (processing) {
        // If busy, we might queue or skip. For now, let's log and likely skip if very busy, 
        // but since this is chunked by VAD, we generally want to process it.
        // However, if we pile up, latency increases.
        console.warn("Processing busy, queuing or skipping...");
    }
    processing = true;

    try {
        const [tokenizer, processor, model] =
            await AutomaticSpeechRecognitionPipeline.getInstance();

        const inputs = await processor(audio);

        const outputs = await model.generate({
            ...inputs,
            max_new_tokens: MAX_NEW_TOKENS,
            language: currentLanguage,
        });

        const decoded = tokenizer.batch_decode(outputs, {
            skip_special_tokens: true,
        });

        const text = decoded[0].trim();
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
        await loadModels(); // Ensure Whisper is loaded

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        // Restore Audio Playback (Route to speakers)
        if (!audioContext) {
            audioContext = new AudioContext();
        }
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(audioContext.destination);
        console.log("Audio routing restored.");

        console.log("Stream Debug:", {
            id: stream.id,
            active: stream.active,
            tracks: stream.getAudioTracks().map(t => ({ id: t.id, kind: t.kind, label: t.label, readyState: t.readyState }))
        });

        // Initialize vad-web

        // HACK: Monkey Patch getUserMedia to bypass permissions check
        // MicVAD calls this internally even if stream is provided, causing NotAllowedError in Offscreen
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
            console.log("Intercepted getUserMedia call from MicVAD");
            return stream;
        };

        try {
            vadInstance = await MicVAD.new({
                stream: stream,
                baseAssetPath: chrome.runtime.getURL('/'),
                onnxWASMBasePath: chrome.runtime.getURL('assets/wasm/'),
                positiveSpeechThreshold: 0.8,
                negativeSpeechThreshold: 0.45,
                redemptionMs: 100,
                onSpeechStart: () => {
                    console.log("VAD: Speech Start");
                },
                onSpeechEnd: (audio) => {
                    const lenSec = audio.length / 16000;
                    console.log(`VAD: Speech End (Length: ${lenSec.toFixed(2)}s)`);
                    generate(audio, true);
                },
                onVADMisfire: () => {
                    console.log("VAD: Misfire (Noise)");
                }
            });
        } finally {
            // Restore original
            navigator.mediaDevices.getUserMedia = originalGetUserMedia;
        }

        vadInstance.start();
        console.log("VAD Started");

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

    chrome.runtime.sendMessage({
        target: 'content',
        type: 'SUBTITLE_UPDATE',
        text: ''
    }).catch(() => { });
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.target === 'offscreen') {
            if (message.type === 'START_RECORDING') {
                if (message.language) {
                    currentLanguage = message.language;
                }
                if (message.model_id && message.model_id !== AutomaticSpeechRecognitionPipeline.model_id) {
                    await AutomaticSpeechRecognitionPipeline.reset(message.model_id);
                    await loadModels();
                }
                startRecording(message.data);
            } else if (message.type === 'STOP_RECORDING') {
                stopRecording();
            } else if (message.type === 'UPDATE_SETTINGS') {
                // ... settings updates ...
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
            }
        }
    })();
});

// Initial Load
loadModels();
