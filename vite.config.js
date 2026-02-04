import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
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
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/offscreen.html'),
        background: resolve(__dirname, 'src/background.js'),
        content: resolve(__dirname, 'src/content.js'),
        popup: resolve(__dirname, 'src/popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
});
