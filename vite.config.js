import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import manifest from './manifest.config.js';

export default defineConfig({
  plugins: [
    svelte(),
    crx({ manifest }),
    // zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@huggingface/transformers/dist/*.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@huggingface/transformers/dist/*.mjs',
          dest: 'assets',
        },
        // VAD-WEB Assets
        {
          src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
          dest: 'assets',
        },
        {
          src: 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx',
          dest: 'assets',
        },
        // ONNX Runtime Assets 
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.mjs',
          dest: 'assets',
        },
      ],
    }),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen/offscreen.html',
      }
    },
  },
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
  worker: {
    format: 'es',
  },
});
