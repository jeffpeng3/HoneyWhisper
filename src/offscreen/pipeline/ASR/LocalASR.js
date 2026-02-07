import { pipeline, env } from "@huggingface/transformers";
import ortWasmUrl from '../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import { BaseASR } from "./BaseASR.js";

// Configure local environment for Extensions
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.jsep.wasm': ortWasmUrl,
    'ort-wasm-simd-threaded.jsep.mjs': chrome.runtime.getURL('assets/ort-wasm-simd-threaded.jsep.mjs'),
    'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL('assets/ort-wasm-simd-threaded.wasm'),
    'ort-wasm-simd-threaded.mjs': chrome.runtime.getURL('assets/ort-wasm-simd-threaded.mjs'),
};
env.backends.onnx.logLevel = 'error';

const MAX_NEW_TOKENS = 64;

export class LocalASR extends BaseASR {
    constructor() {
        super();
        this.transcriber = null;
        this.model_id = null;
        this.quantization = null;
        this.device = null;
        this.language = 'en';
    }

    async load(config) {
        const { model_id, quantization, progress_callback, device = "webgpu", language = 'en' } = config;

        // Update language regardless of whether we reload the model
        this.language = language;

        // Check if we need to reload
        if (this.transcriber && this.model_id === model_id && this.quantization === quantization && this.device === device) {
            return;
        }

        if (this.transcriber) {
            await this.release();
        }

        this.model_id = model_id;
        this.quantization = quantization;
        this.device = device;

        this.transcriber = await pipeline(
            "automatic-speech-recognition",
            this.model_id,
            {
                dtype: this.quantization,
                device: this.device,
                progress_callback,
            }
        );
    }

    async transcribe(audioData) {
        if (!this.transcriber) {
            throw new Error("Model not loaded");
        }

        const generateOptions = {
            max_new_tokens: MAX_NEW_TOKENS,
            return_timestamps: false,
            language: this.language,
        };

        const output = await this.transcriber(audioData, generateOptions);
        return { text: output.text.trim() };
    }

    async release() {
        console.log("Releasing Local Pipeline resources...");
        if (this.transcriber) {
            if (this.transcriber.dispose) {
                await this.transcriber.dispose();
            }
            this.transcriber = null;
        }
    }
}

// Register implementations
BaseASR.register('webgpu', LocalASR);
BaseASR.register('wasm', LocalASR);
