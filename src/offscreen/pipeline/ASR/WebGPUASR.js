import { pipeline, env } from "@huggingface/transformers";
import { BaseASR } from "./BaseASR.js";

// Configure local environment for Extensions
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/');
env.backends.onnx.logLevel = 'error';

const MAX_NEW_TOKENS = 64;

export class WebGPUASR extends BaseASR {
    constructor() {
        super();
        this.transcriber = null;
        this.model_id = null;
        this.quantization = null;
    }

    async load(config) {
        const { model_id, quantization, progress_callback } = config;

        // Check if we need to reload
        if (this.transcriber && this.model_id === model_id && this.quantization === quantization) {
            return;
        }

        if (this.transcriber) {
            await this.release();
        }

        this.model_id = model_id;
        this.quantization = quantization;

        this.transcriber = await pipeline(
            "automatic-speech-recognition",
            this.model_id,
            {
                dtype: this.quantization,
                device: "webgpu",
                progress_callback,
            }
        );
    }

    async transcribe(audioData) {
        if (!this.transcriber) {
            throw new Error("Model not loaded");
        }

        // We can add language support here if passed in arguments or config
        const generateOptions = {
            max_new_tokens: MAX_NEW_TOKENS,
            return_timestamps: false,
        };

        const output = await this.transcriber(audioData, generateOptions);
        return { text: output.text.trim() };
    }

    async release() {
        console.log("Releasing WebGPU pipeline resources...");
        if (this.transcriber) {
            if (this.transcriber.dispose) {
                await this.transcriber.dispose();
            }
            this.transcriber = null;
        }
    }
}
