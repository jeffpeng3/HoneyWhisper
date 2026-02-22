import { resolve } from 'node:path';
import { defineWxtModule } from 'wxt/modules';

export default defineWxtModule((wxt) => {
    wxt.hook('build:publicAssets', (_, assets) => {
        const copyAssets = [
            {
                src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
                dest: 'vad.worklet.bundle.min.js',
            },
            {
                src: 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx',
                dest: 'silero_vad_v5.onnx',
            },
            {
                src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
                dest: 'ort-wasm-simd-threaded.jsep.wasm',
            },
            {
                src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
                dest: 'ort-wasm-simd-threaded.wasm',
            },
            {
                src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
                dest: 'ort-wasm-simd-threaded.jsep.mjs',
            },
            {
                src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
                dest: 'ort-wasm-simd-threaded.mjs',
            }
        ];

        for (const asset of copyAssets) {
            assets.push({
                absoluteSrc: resolve(process.cwd(), asset.src),
                relativeDest: asset.dest,
            });
        }
    });
});
