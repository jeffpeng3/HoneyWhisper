export const DEFAULT_MODELS = [
    {
        "id": "onnx-community/whisper-tiny",
        "name": "Tiny (WebGPU)",
        "type": "webgpu",
        "config": { "quantization": "q4" },
        "homepage": "https://huggingface.co/onnx-community/whisper-tiny"
    },
    {
        "id": "onnx-community/whisper-base",
        "name": "Base (WebGPU)",
        "type": "webgpu",
        "config": { "quantization": "q4" },
        "homepage": "https://huggingface.co/onnx-community/whisper-base"
    },
    {
        "id": "onnx-community/whisper-small",
        "name": "Small (WebGPU)",
        "type": "webgpu",
        "config": { "quantization": "q4" },
        "homepage": "https://huggingface.co/onnx-community/whisper-small"
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

export const DEFAULT_PROFILES = [
    {
        id: 'default-tiny',
        name: 'Fast (Tiny)',
        backend: 'webgpu',
        model_id: 'onnx-community/whisper-tiny',
        quantization: 'q4',
        remote_endpoint: '',
        remote_key: ''
    },
    {
        id: 'default-base',
        name: 'Balanced (Base)',
        backend: 'webgpu',
        model_id: 'onnx-community/whisper-base',
        quantization: 'q4',
        remote_endpoint: '',
        remote_key: ''
    }
];

export class ModelRegistry {
    /**
     * Get list of default available models
     * @returns {Array} List of model objects
     */
    static getModels() {
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

    static createProfile(name, modelId, backend = 'webgpu', options = {}) {
        return {
            id: crypto.randomUUID(),
            name: name,
            backend: backend,
            model_id: modelId,
            quantization: options.quantization || 'q4',
            remote_endpoint: options.endpoint || '',
            remote_key: options.key || ''
        };
    }
}
