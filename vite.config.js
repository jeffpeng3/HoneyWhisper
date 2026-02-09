import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import manifest from './manifest.config.js';
import fs from 'fs';
import path from 'path';
const renamePopup = () => {
  const source = 'src/popup/popup.html';
  const destination = 'popup.html';
  return {
    name: 'crx:rename-file',
    enforce: 'post',
    generateBundle(options, bundle) {
      bundle[source].fileName = destination;
    },
    renderCrxManifest(manifest) {
      manifest.action.default_popup = destination;
      return manifest;
    },
  };
};

const renameOptions = () => {
  const source = 'src/options/options.html';
  const destination = 'options.html';
  return {
    name: 'crx:rename-file',
    enforce: 'post',
    generateBundle(options, bundle) {
      bundle[source].fileName = destination;
    },
    renderCrxManifest(manifest) {
      manifest.options_ui.page = destination;
      return manifest;
    },
  };
};

const renameOffscreen = () => {
  const source = 'src/offscreen/offscreen.html';
  const destination = 'offscreen.html';
  return {
    name: 'crx:rename-file',
    enforce: 'post',
    generateBundle(options, bundle) {
      bundle[source].fileName = destination;
    },
  };
};

const shareWasm = () => {
  const source = 'src/offscreen/offscreen.html';
  const destination = 'offscreen.html';
  return {
    name: 'crx:rename-file',
    enforce: 'post',
    generateBundle(options, bundle) {
      bundle[source].fileName = destination;
    },
  };
};

function getPackageVersion(packageName) {
  const pkgJsonPath = path.resolve(
    process.cwd(),
    'node_modules',
    packageName,
    'package.json'
  );

  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return pkg.version;
  }

  const resolvedPath = require.resolve(`${packageName}/package.json`);
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')).version;
}

export default defineConfig({
  define: {
    __ONNX_VERSION__: JSON.stringify(getPackageVersion('onnxruntime-web')),
    __VAD_VERSION__: JSON.stringify(getPackageVersion('@ricky0123/vad-web')),
  },
  plugins: [
    svelte(),
    crx({ manifest }),
    renamePopup(),
    renameOptions(),
    renameOffscreen(),
    viteStaticCopy({
      targets: [
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
          src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.mjs',
          dest: 'assets',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
      "$lib": path.resolve(process.cwd(), "./src/lib"),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen/offscreen.html',
      },
    },
  },
  worker: {
    format: 'es',
  },
});
