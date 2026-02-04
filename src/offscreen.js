import {
    AutoTokenizer,
    AutoProcessor,
    WhisperForConditionalGeneration,
    TextStreamer,
} from "@huggingface/transformers";
import { env } from "@huggingface/transformers";

console.log("Offscreen Script Loaded - Version 2.0");

// Configure local environment for Extensions (Manifest V3 Compliance)
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');
env.backends.onnx.logLevel = 'error';

const MAX_NEW_TOKENS = 64;
const WHISPER_SAMPLING_RATE = 16_000;

// Singleton Model Class
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

let processing = false;
let recorder = null;
let audioContext = null;
let stream = null;
let currentLanguage = 'en';

// Progress Reporting
function reportProgress(data) {
    chrome.runtime.sendMessage({
        type: 'MODEL_LOADING',
        target: 'popup',
        data
    }).catch(() => { });
}

// Load Model
async function loadModel() {
    try {
        reportProgress({ status: 'initiate', name: AutomaticSpeechRecognitionPipeline.model_id, file: 'model' });
        await AutomaticSpeechRecognitionPipeline.getInstance((data) => {
            reportProgress(data);
        });
        reportProgress({ status: 'done', name: AutomaticSpeechRecognitionPipeline.model_id, file: 'model' });
        console.log("Model loaded successfully");
    } catch (error) {
        console.error("Model load error:", error);
        reportProgress({ status: 'error', error: error.message });
    }
}

// Generate Subtitles
async function generate(audio) {
    if (processing) return;
    processing = true;

    // Calculate max amplitude to verify audio input
    let maxAmp = 0;
    for (let i = 0; i < audio.length; i++) {
        if (Math.abs(audio[i]) > maxAmp) maxAmp = Math.abs(audio[i]);
    }
    console.log(`Processing audio chunk: length=${audio.length}, maxAmp=${maxAmp.toFixed(4)}`);

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

        console.log("Generated Text:", decoded[0]);

        if (decoded[0] && decoded[0].trim().length > 0) {
            chrome.runtime.sendMessage({
                target: 'content',
                type: 'SUBTITLE_UPDATE',
                text: decoded[0]
            }).catch((err) => console.warn("Failed to send subtitle:", err));
        }

    } catch (err) {
        console.error("Generation Error:", err);
    } finally {
        processing = false;
    }
}

// Start Recording
async function startRecording(streamId) {
    if (recorder) return;
    if (processing) return;

    try {
        await AutomaticSpeechRecognitionPipeline.getInstance();

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        audioContext = new AudioContext({ sampleRate: WHISPER_SAMPLING_RATE });
        await audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));

        const source = audioContext.createMediaStreamSource(stream);
        recorder = new AudioWorkletNode(audioContext, 'audio-processor');

        source.connect(recorder);
        recorder.connect(audioContext.destination); // Keep pipeline alive
        source.connect(audioContext.destination);   // Playback to user

        recorder.port.onmessage = async (e) => {
            const inputData = e.data;
            if (processing) return;
            // VAD could go here
            if (inputData && inputData.length > 0) {
                await generate(inputData);
            }
        };

        console.log("Recording started with AudioWorklet");
    } catch (err) {
        console.error("Error starting recording:", err);
    }
}

function stopRecording() {
    processing = false;
    if (recorder) {
        try {
            recorder.disconnect();
        } catch (e) { }
        recorder = null;
    }
    if (audioContext) {
        try {
            audioContext.close();
        } catch (e) { }
        audioContext = null;
    }
    stream = null;

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
                    console.log(`Switching model to ${message.model_id}`);
                    if (typeof AutomaticSpeechRecognitionPipeline.reset === 'function') {
                        await AutomaticSpeechRecognitionPipeline.reset(message.model_id);
                        await loadModel();
                    }
                }
                startRecording(message.data);
            } else if (message.type === 'STOP_RECORDING') {
                stopRecording();
            } else if (message.type === 'UPDATE_SETTINGS') {
                if (message.settings && message.settings.language) {
                    currentLanguage = message.settings.language;
                }
                if (message.settings && message.settings.model_id && message.settings.model_id !== AutomaticSpeechRecognitionPipeline.model_id) {
                    await AutomaticSpeechRecognitionPipeline.reset(message.settings.model_id);
                    await loadModel();
                }
            } else if (message.type === 'CLEAR_CACHE') {
                try {
                    const names = await caches.keys();
                    await Promise.all(names.map(name => caches.delete(name)));
                    console.log("Caches cleared:", names);
                    reportProgress({ status: 'error', error: 'Cache Cleared! Please reload.' });
                } catch (err) {
                    console.error("Failed to clear cache:", err);
                }
            }
        }
    })();
});

// Initial Load
loadModel();
