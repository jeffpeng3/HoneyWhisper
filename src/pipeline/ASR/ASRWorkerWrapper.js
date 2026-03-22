import ASRWorkerScript from './ASRWorker.js?worker';

export class ASRWorkerWrapper {
    constructor(type) {
        // Create the worker via Vite ?worker import
        this.worker = new ASRWorkerScript();
        this.msgId = 0;
        this.callbacks = {};
        this.progressCallback = null;

        this.worker.onmessage = (e) => {
            const { id, status, result, error, action, payload } = e.data;
            
            // Handle streaming progress callbacks
            if (action === 'progress') {
                if (this.progressCallback) {
                    this.progressCallback(payload);
                }
                return;
            }
            
            // Handle RPC response
            if (this.callbacks[id]) {
                if (status === 'success') {
                    this.callbacks[id].resolve(result);
                } else {
                    this.callbacks[id].reject(new Error(error));
                }
                delete this.callbacks[id];
            }
        };

        // Initialize immediately with the main thread's explicit root path
        const extensionRoot = new URL('/', self.location.href).href;
        this.initPromise = this._send('init', { type, extensionRoot });
    }

    _send(action, payload) {
        return new Promise((resolve, reject) => {
            const id = ++this.msgId;
            this.callbacks[id] = { resolve, reject };
            this.worker.postMessage({ action, payload, id });
        });
    }

    async load(config) {
        await this.initPromise;
        this.progressCallback = config.progress_callback;
        
        // Remove progress_callback before cloning over postMessage
        const safeConfig = { ...config };
        delete safeConfig.progress_callback;
        
        await this._send('load', safeConfig);
    }

    async download(config) {
        await this.initPromise;
        this.progressCallback = config.progress_callback;

        const safeConfig = { ...config };
        delete safeConfig.progress_callback;

        await this._send('download', safeConfig);
    }

    async transcribe(audioData) {
        await this.initPromise;
        // Pass Float32Array into worker
        return await this._send('transcribe', { audio: audioData });
    }

    async release() {
        await this.initPromise;
        await this._send('release');
        this.worker.terminate();
    }
}
