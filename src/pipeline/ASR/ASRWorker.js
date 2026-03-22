// ASRWorker.js
// Do NOT statically import BaseASR or registry_loader here, otherwise Vite's hoisting
// will initialize ONNX runtime before we can configure `self.ort`!

let asrInstance = null;

self.onmessage = async (e) => {
    const { action, payload, id } = e.data;

    try {
        if (action === 'init') {
            const { type, extensionRoot } = payload;
            
            // Set up WASM paths globally BEFORE any ONNX runtime code evaluates
            // Use a STRING prefix instead of a dictionary to guarantee it applies to any requested WASM file.
            self.ort = {
                env: {
                    wasm: {
                        wasmPaths: extensionRoot
                    }
                }
            };
            console.log("[ASRWorker] Dynamically configuring ONNX paths to:", extensionRoot);

            // Now dynamically import the ASR modules
            const { BaseASR } = await import("./BaseASR.js");
            await import("../registry_loader.js");

            // Initialize the specifically requested backend
            const TargetClass = BaseASR.get(type);
            if (!TargetClass) throw new Error(`ASR Backend '${type}' not found`);
            asrInstance = BaseASR.create(type);
            
            self.postMessage({ id, status: 'success' });
        } else if (action === 'load') {
            payload.progress_callback = (data) => {
                self.postMessage({ id, action: 'progress', payload: data });
            };
            await asrInstance.load(payload);
            self.postMessage({ id, status: 'success' });
        } else if (action === 'download') {
            payload.progress_callback = (data) => {
                self.postMessage({ id, action: 'progress', payload: data });
            };
            await asrInstance.download(payload);
            self.postMessage({ id, status: 'success' });
        } else if (action === 'transcribe') {
            const result = await asrInstance.transcribe(payload.audio);
            self.postMessage({ id, status: 'success', result });
        } else if (action === 'release') {
            if (asrInstance) {
                await asrInstance.release();
                asrInstance = null;
            }
            self.postMessage({ id, status: 'success' });
        }
    } catch (err) {
        console.error("[ASRWorker] Fatal Error:", err);
        self.postMessage({ id, status: 'error', error: err.message || err.toString() });
    }
};
