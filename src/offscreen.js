import {
    AutoTokenizer,
    AutoProcessor,
    WhisperForConditionalGeneration,
    TextStreamer,
    full,
    env
} from "@huggingface/transformers";

// Configure local environment for Extensions (Manifest V3 Compliance)
env.allowLocalModels = false; // We are fetching from cache/internet, but not local FS in Node sense
env.useBrowserCache = true;
// Point to local WASM files copied by Vite
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');
// We also need to configure the proxy/js path if it tries to load that
// For transformers.js v3, it dynamically imports. We need to trick it or ensure `wasmPaths` handles the JS too if it looks for it there.

const MAX_NEW_TOKENS = 64;
const WHISPER_SAMPLING_RATE = 16_000;
const MAX_AUDIO_LENGTH = 30; // seconds
const MAX_SAMPLES = WHISPER_SAMPLING_RATE * MAX_AUDIO_LENGTH;

// Singleton Model Class
class AutomaticSpeechRecognitionPipeline {
    static model_id = "onnx-community/whisper-base";
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
                    encoder_model: "fp32",
                    decoder_model_merged: "q4",
                },
                device: "webgpu",
                progress_callback,
            },
        );

        return Promise.all([this.tokenizer, this.processor, this.model]);
    }
}

let processing = false;
let recorder = null;
let audioContext = null;
let chunks = [];

// Settings
let currentLanguage = 'en';

// Listen for settings updates from background
// chrome.storage is not available in offscreen document? context issues.
// We will receive settings from background.

async function generate(audio) {
    if (processing) return;
    processing = true;

    try {
        const [tokenizer, processor, model] =
            await AutomaticSpeechRecognitionPipeline.getInstance();

        const inputs = await processor(audio);

        // We can implement streaming here if we want partial updates
        // For now, let's keep it simple: generate and send
        // Use currentLanguage
        const outputs = await model.generate({
            ...inputs,
            max_new_tokens: MAX_NEW_TOKENS,
            language: currentLanguage,
        });

        const decoded = tokenizer.batch_decode(outputs, {
            skip_special_tokens: true,
        });

        // Send output to background -> content
        chrome.runtime.sendMessage({
            target: 'content',
            type: 'SUBTITLE_UPDATE',
            text: decoded[0]
        });

    } catch (err) {
        console.error("Generation Error:", err);
    } finally {
        processing = false;
    }
}


// Audio Processing State
// audioContext is already declared above
let scriptProcessor = null;
let audioBuffer = []; // Float32 Array of samples at 16k
const BUFFER_SIZE = 4096;

function resampleAndPush(inputData, sampleRate) {
    // Simple resampler to 16000Hz
    const targetSampleRate = WHISPER_SAMPLING_RATE;
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.round(inputData.length / ratio);

    for (let i = 0; i < newLength; i++) {
        const originalIndex = Math.floor(i * ratio);
        // Basic nearest neighbor for speed, or linear interpolation
        // Let's do nearest neighbor for simplicity in demo
        if (originalIndex < inputData.length) {
            audioBuffer.push(inputData[originalIndex]);
        }
    }

    // Keep only last MAX_SAMPLES
    if (audioBuffer.length > MAX_SAMPLES) {
        audioBuffer.splice(0, audioBuffer.length - MAX_SAMPLES);
    }
}

async function startRecording(streamId) {
    if (audioContext) {
        audioContext.close();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        },
        video: false
    });

    audioContext = new AudioContext(); // Browser default rate (usually 44100 or 48000)
    const source = audioContext.createMediaStreamSource(stream);

    // Use ScriptProcessor (bufferSize, inputChannels, outputChannels)
    // 4096 samples @ 48kHz is ~85ms
    scriptProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    source.connect(scriptProcessor);
    source.connect(audioContext.destination); // Connect to destination to hear the audio
    scriptProcessor.connect(audioContext.destination); // Connect to destination to keep it alive (and maybe hear it?)
    // If we connect to destination in offscreen, it might play nowhere or play in extension background.
    // Usually we want to Avoid hearing it double if we are just transcribing.
    // But ScriptProcessor stops if not connected to destination in some browsers.
    // Let's connect it. If it echoes, we will create a GainNode(0).
    const gainZero = audioContext.createGain();
    gainZero.gain.value = 0;
    scriptProcessor.connect(gainZero);
    gainZero.connect(audioContext.destination);

    scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        resampleAndPush(inputData, audioContext.sampleRate);
    };

    // Start processing loop
    processing = false;
    processLoop();
}

async function processLoop() {
    if (!audioContext || audioContext.state === 'closed') return;

    if (audioBuffer.length > WHISPER_SAMPLING_RATE * 1 && !processing) { // at least 1 second
        // Clone buffer to avoid race conditions
        const input = new Float32Array(audioBuffer);
        await generate(input);
    }

    // Run often enough to feel real-time
    setTimeout(processLoop, 200);
}

// Listen for messages
chrome.runtime.onMessage.addListener((message) => {
    if (message.target === 'offscreen') {
        if (message.type === 'START_RECORDING') {
            if (message.language) {
                currentLanguage = message.language;
            }
            startRecording(message.data);
        } else if (message.type === 'STOP_RECORDING') {
            stopRecording();
        } else if (message.type === 'UPDATE_SETTINGS') {
            if (message.settings && message.settings.language) {
                currentLanguage = message.settings.language;
            }
        }
    }
});

function stopRecording() {
    processing = false;
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    // Also notify content to clear overlay?
    chrome.runtime.sendMessage({
        target: 'content',
        type: 'SUBTITLE_UPDATE',
        text: ''
    });
}

// Preload model
AutomaticSpeechRecognitionPipeline.getInstance((x) => console.log("Loading model:", x));
