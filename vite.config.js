import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import manifest from './manifest.config.js';
import { name, version } from './package.json'
import zip from 'vite-plugin-zip-pack'

export default defineConfig({
  plugins: [
    svelte(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
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
          src: 'node_modules/@ricky0123/vad-web/dist/*.onnx',
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
