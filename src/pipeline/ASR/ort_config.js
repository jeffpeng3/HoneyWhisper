// This file MUST be imported FIRST in ASRWorker.js, before any other imports!
// It sets the global `self.ort` object so that when onnxruntime-web evaluates,
// it immediately picks up our custom WASM paths.

const extensionRoot = new URL('/', self.location.href).href;

self.ort = {
    env: {
        wasm: {
            wasmPaths: {
                'ort-wasm-simd-threaded.jsep.wasm': extensionRoot + 'ort-wasm-simd-threaded.jsep.wasm',
                'ort-wasm-simd-threaded.jsep.mjs': extensionRoot + 'ort-wasm-simd-threaded.jsep.mjs',
                'ort-wasm-simd-threaded.wasm': extensionRoot + 'ort-wasm-simd-threaded.wasm',
                'ort-wasm-simd-threaded.mjs': extensionRoot + 'ort-wasm-simd-threaded.mjs',
            }
        }
    }
};

console.log("[ort_config] Global self.ort initialized with extensionRoot:", extensionRoot);
