import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, '').split(/[.-]/);

export default defineManifest(async (env) => ({
    manifest_version: 3,
    name: 'HoneyWhisper',
    version: `${major}.${minor}.${patch}`,
    description: 'Real-time speech-to-text using HoneyWhisper',
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
    background: {
        service_worker: 'src/background/background.js',
        type: 'module',
    },
    action: {
        default_popup: 'src/popup/popup.html',
        default_icon: {
            128: 'icons/icon_idle.png',
        },
    },
    options_ui: {
        page: 'src/options/options.html',
        open_in_tab: true,
    },
    icons: {
        128: 'icons/icon_idle.png',
    },
    // web_accessible_resources: [
    //     {
    //         resources: [
    //             'assets/*',
    //         ],
    //         matches: [
    //             '<all_urls>',
    //         ],
    //     },
    // ],
    content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
}));
