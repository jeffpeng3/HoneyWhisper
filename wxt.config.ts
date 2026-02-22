import { defineConfig } from 'wxt';
import fs from 'fs';
import path from 'path';


function getPackageVersion(packageName: string) {
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
    modules: ['@wxt-dev/module-svelte', '@wxt-dev/i18n/module'],
    manifest: {
        name: 'HoneyWhisper',
        default_locale: 'zh_TW',
        icons: {
            "16": "icons/icon_idle.png",
            "48": "icons/icon_idle.png",
            "128": "icons/icon_idle.png"
        },
        action: {
            default_icon: {
                "16": "icons/icon_idle.png",
                "48": "icons/icon_idle.png",
                "128": "icons/icon_idle.png"
            }
        },
        options_ui: {
            page: "options.html",
            open_in_tab: true
        },
        permissions: [
            'tabCapture',
            'offscreen',
            'activeTab',
            'scripting',
            'storage',
        ],
        host_permissions: [
            'https://api.github.com/*',
        ],
        web_accessible_resources: [
            {
                resources: ['*.wasm', '*.mjs', '*.onnx', 'vad.worklet.bundle.min.js'],
                matches: ['<all_urls>'],
            },
        ],
        content_security_policy: {
            extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
        },
    },
    vite: () => ({
        define: {
            __ONNX_VERSION__: JSON.stringify(getPackageVersion('onnxruntime-web')),
            __VAD_VERSION__: JSON.stringify(getPackageVersion('@ricky0123/vad-web')),
        },
        resolve: {
            alias: {
                "@/pipeline": path.resolve(process.cwd(), "./src/pipeline"),
                "@": path.resolve(process.cwd(), "./src"),
                $lib: path.resolve(process.cwd(), "./src/lib"),
            }
        },
        build: {
            target: 'esnext',
        },
        worker: {
            format: 'es',
        },
    }),
});
