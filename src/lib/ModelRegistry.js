export const DEFAULT_MODELS = [
    {
        "id": "onnx-community/whisper-tiny",
        "name": "Tiny (WebGPU)",
        "type": "webgpu",
        "config": { "quantization": "q4" }
    },
    {
        "id": "onnx-community/whisper-base",
        "name": "Base (WebGPU)",
        "type": "webgpu",
        "config": { "quantization": "q4" }
    },
    {
        "id": "local-server",
        "name": "Local Server (OpenAI Compatible)",
        "type": "remote",
        "config": {
            "endpoint": "http://localhost:9000/v1/audio/transcriptions",
            "key": ""
        }
    }
];

export class ModelRegistry {
    /**
     * Get list of available models
     * @returns {Array} List of model objects
     */
    static getModels() {
        // TODO: Fetch from remote JSON (Model Hub)
        return DEFAULT_MODELS;
    }

    /**
     * Get model configuration by ID
     * @param {string} id 
     * @returns {object|undefined}
     */
    static getModelById(id) {
        return DEFAULT_MODELS.find(m => m.id === id);
    }
}
