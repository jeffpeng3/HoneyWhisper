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
    },
    {
        id: 'default-jp',
        name: 'Japanese (ReazonSpeech)',
        backend: 'wasm',
        model_id: 'reazon-research/reazonspeech-k2-v2',
        quantization: 'int8',
        remote_endpoint: '',
        remote_key: ''
    }
];

export class ModelRegistry {

    /**
     * Get model configuration by ID
     * (Warning: This now relies on fetching first or external knowledge, 
     *  as we don't have a synchronous default list anymore)
     * @param {string} id 
     * @returns {object|undefined}
     */

    /**
     * Fetch models from GitHub
     * @returns {Promise<{models: Array, error: string|null}>}
     */
    static async fetchModels() {
        const GITHUB_URL = "https://raw.githubusercontent.com/jeffpeng3/HoneyWhisper/master/public/models.json";
        try {
            const response = await fetch(GITHUB_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawModels = await response.json();

            // Basic validation
            if (!Array.isArray(rawModels) || rawModels.length === 0) throw new Error("Invalid model format");

            // Map simplified schema to internal app schema
            const models = rawModels.map(m => {
                let type = 'webgpu';
                let config = { quantization: 'q4' }; // Default
                let homepage = '';

                if (m.engine === 'k2ASR' || m.engine === 'k2') {
                    type = 'wasm'; // Default backend for K2
                    config = { quantization: 'int8' };
                    homepage = `https://huggingface.co/${m.id}`;
                } else if (m.engine === 'transformers.js') {
                    type = 'webgpu';
                    homepage = `https://huggingface.co/${m.id}`;
                } else if (m.engine === 'remote') {
                    type = 'remote';
                    config = {
                        endpoint: "http://localhost:9000/v1/audio/transcriptions",
                        key: ""
                    };
                }

                return {
                    id: m.id,
                    name: m.name,
                    engine: m.engine,
                    type: type,
                    config: config,
                    homepage: homepage
                };
            });

            return { models, error: null };
        } catch (err) {
            console.warn("Failed to fetch models from GitHub:", err);
            return { models: [], error: err.message };
        }
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
