export interface Profile {
    id: string;
    name: string;
    backend: string;
    model_id: string;
    quantization: string;
    remote_endpoint: string;
    remote_key: string;
}

export interface HubModel {
    id: string;
    name: string;
    engine: string;
    type: string;
    config: Record<string, string>;
    homepage: string;
}

interface RawModel {
    id: string;
    name: string;
    engine: string;
}

export const DEFAULT_PROFILES: Profile[] = [
    {
        id: 'default-jp',
        name: 'Japanese (ReazonSpeech)',
        backend: 'wasm',
        model_id: 'reazon-research/reazonspeech-k2-v2',
        quantization: 'int8',
        remote_endpoint: '',
        remote_key: ''
    },
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
     * Fetch models from GitHub
     */
    static async fetchModels(): Promise<{ models: HubModel[]; error: string | null }> {
        const GITHUB_URL = "https://raw.githubusercontent.com/jeffpeng3/HoneyWhisper/master/public/models.json";
        try {
            const response = await fetch(GITHUB_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawModels: RawModel[] = await response.json();

            // Basic validation
            if (!Array.isArray(rawModels) || rawModels.length === 0) throw new Error("Invalid model format");

            // Map simplified schema to internal app schema
            const models: HubModel[] = rawModels.map(m => {
                let type = 'webgpu';
                let config: Record<string, string> = { quantization: 'q4' }; // Default
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
            return { models: [], error: (err as Error).message };
        }
    }

    /**
     * Check if a profile's model is already cached in the browser
     */
    static async checkModelCached(profile: Profile): Promise<boolean> {
        // Remote models don't need download
        if (profile.backend === 'remote') return true;

        try {
            // K2 models: check k2-models-v1 cache for encoder file
            if (profile.model_id.includes('k2')) {
                const cache = await caches.open('k2-models-v1');
                const encoderUrl = `https://huggingface.co/${profile.model_id}/resolve/main/encoder-epoch-99-avg-1.int8.onnx`;
                const match = await cache.match(encoderUrl);
                return !!match;
            }

            // transformers.js models: scan transformers-cache entries
            const keys = await caches.keys();
            for (const key of keys.filter(k => k.startsWith('transformers-cache'))) {
                const cache = await caches.open(key);
                const cachedRequests = await cache.keys();
                const found = cachedRequests.some(req => req.url.includes(profile.model_id));
                if (found) return true;
            }
            return false;
        } catch (err) {
            console.warn('Failed to check model cache:', err);
            // If cache check fails, assume not cached (safer UX)
            return false;
        }
    }

    static createProfile(
        name: string,
        modelId: string,
        backend: string = 'webgpu',
        options: { quantization?: string; endpoint?: string; key?: string } = {}
    ): Profile {
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
