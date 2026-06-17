import { resolve } from 'node:path';
import { defineWxtModule } from 'wxt/modules';

const ORT_DIR = 'node_modules/@jeffpeng3/nemotron-asr-core/node_modules/onnxruntime-web/dist';

const WASM_FILES = [
    'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.asyncify.mjs',
];

export default defineWxtModule((wxt) => {
    wxt.hook('build:publicAssets', (_, assets) => {
        for (const file of WASM_FILES) {
            assets.push({
                absoluteSrc: resolve(process.cwd(), ORT_DIR, file),
                relativeDest: file,
            });
        }
    });
});
