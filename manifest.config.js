import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

const { version } = packageJson;

// Convert from Semver (e.g., 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
    // can only contain digits, dots, or dash
    .replace(/[^\d.-]+/g, '')
    // split into version parts
    .split(/[.-]/);

export default defineManifest(async (env) => ({
    manifest_version: 3,
    name: 'HoneyWhisper',
    version: `${major}.${minor}.${patch}.${label}`,
    description: 'Real-time speech-to-text using HoneyWhisper',
    permissions: [
        'tabCapture',
        'offscreen',
        'activeTab',
        'scripting',
        'storage',
    ],
    background: {
        service_worker: 'src/background/index.js',
        type: 'module',
    },
    action: {
        default_popup: 'src/popup/index.html',
        default_icon: {
            16: 'icons/icon16.png',
            48: 'icons/icon48.png',
            128: 'icons/icon128.png',
        },
    },
    icons: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
    },
    web_accessible_resources: [
        {
            resources: [
                'src/offscreen/index.html',
                'src/content/index.js',
                'assets/*',
            ],
            matches: [
                '<all_urls>',
            ],
        },
    ],
    content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
}));
