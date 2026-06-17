import { resolve } from 'node:path';
import { rmSync, existsSync, readdirSync } from 'node:fs';
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

    wxt.hook('build:done', () => {
        const outDir = wxt.config.outDir;
        const assetsDir = resolve(outDir, 'assets');
        if (!existsSync(assetsDir)) return;

        for (const f of readdirSync(assetsDir)) {
            if (f.includes('ort-wasm-simd-threaded')) {
                rmSync(resolve(assetsDir, f));
                console.log(`[wasm-assets] removed duplicate: assets/${f}`);
            }
        }
    });
});
