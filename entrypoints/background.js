import { sendMessage, onMessage } from '$lib/messaging';
import { getSettings } from '$lib/settings';

export default defineBackground(() => {
    const offscreenUrl = '/offscreen.html';
    let offscreenCreating;
    let isRecording = false;
    let currentTabId = null;

    // Check if offscreen document exists
    async function hasOffscreenDocument() {
        const matchedClients = await clients.matchAll();
        return matchedClients.some(c => c.url.endsWith(offscreenUrl));
    }

    async function setupOffscreenDocument() {
        if (await hasOffscreenDocument()) return;

        // Create offscreen document
        if (offscreenCreating) {
            await offscreenCreating;
        } else {
            offscreenCreating = browser.offscreen.createDocument({
                url: offscreenUrl,
                reasons: [browser.offscreen.Reason.USER_MEDIA],
                justification: 'Recording tab audio for transcription',
            });
            await offscreenCreating;
            offscreenCreating = null;
        }
    }

    function setIcon(active) {
        const path = active ? 'icons/icon_active.png' : 'icons/icon_idle.png';
        browser.action.setIcon({ path: path }).catch(() => {
            // Ignore errors if icon setting fails
        });
    }

    async function startCapture(tabId, profile = null) {
        const streamId = await browser.tabCapture.getMediaStreamId({
            targetTabId: tabId,
        });

        currentTabId = tabId;

        let settings;

        if (profile) {
            // Construct settings from passed profile + global settings
            const globalSettings = await getSettings();

            settings = {
                ...globalSettings,
                model_id: profile.model_id,
                quantization: profile.quantization,
                asrBackend: profile.backend,
                remoteEndpoint: profile.remote_endpoint,
                remoteKey: profile.remote_key
            };
        } else {
            // Fallback or Legacy path
            settings = await getSettings();
        }

        sendMessage('START_RECORDING', {
            streamId,
            profileIndex: profile ? profile.id : 0, // Fallback if no profile ID
            pipelineConfig: settings
        });

        isRecording = true;
    }

    async function stopCapture() {
        const tabIdToClear = currentTabId; // Capture current ID before clearing
        isRecording = false;
        currentTabId = null;
        setIcon(false);
        browser.action.setBadgeText({ text: '' });

        // Notify content to remove overlay from the specific tab
        if (tabIdToClear) {
            try {
                sendMessage('REMOVE_OVERLAY', undefined, { tabId: tabIdToClear });
            } catch (e) {
                // Ignore errors (tab might be closed)
            }
        }

        // Close offscreen to release WebGPU resources
        try {
            await browser.offscreen.closeDocument();
        } catch (err) {
            console.error('Error closing offscreen document:', err);
        }
    }

    onMessage('REQUEST_DOWNLOAD', async (message) => {
        await setupOffscreenDocument();
        const profileIndex = message.data.profileIndex;
        const { profiles } = await getSettings();
        const targetProfile = profiles[profileIndex] || {};

        sendMessage('DOWNLOAD_MODEL', {
            profileIndex: profileIndex,
            pipelineConfig: {
                model_id: targetProfile.model_id,
                quantization: targetProfile.quantization,
                asrBackend: targetProfile.backend,
                language: 'en'
            }
        });
    });

    onMessage('REQUEST_START', async (message) => {
        await setupOffscreenDocument();

        const tabId = message.sender.tab?.id || currentTabId;
        let targetTabId = tabId;
        if (!targetTabId) {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            targetTabId = activeTab.id;
        }

        browser.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['/content-scripts/content.js']
        });

        const profileIndex = message.data.profileIndex;
        const { profiles } = await getSettings();
        const targetProfile = profiles[profileIndex];

        await startCapture(targetTabId, targetProfile);
    });

    onMessage('REQUEST_STOP', async () => {
        await stopCapture();
    });

    onMessage('RECORDING_STARTED', () => {
        setIcon(true);
    });

    onMessage('DOWNLOAD_COMPLETE', async () => {
        try {
            await browser.offscreen.closeDocument();
        } catch (err) { }
    });

    onMessage('VAD_STATUS', (message) => {
        if (message.data.status === 'speech') {
            browser.action.setBadgeText({ text: ' ' });
            browser.action.setBadgeBackgroundColor({ color: '#ff7474ff' });
        } else {
            browser.action.setBadgeText({ text: '' });
        }
    });

    // --- Relays from Offscreen to Content Script ---
    onMessage('RESULT', (message) => {
        if (currentTabId) sendMessage('RESULT', message.data, currentTabId).catch(() => { });
    });

    onMessage('CLEAR', () => {
        if (currentTabId) sendMessage('CLEAR', undefined, currentTabId).catch(() => { });
    });

    onMessage('PERFORMANCE_WARNING', (message) => {
        if (currentTabId) sendMessage('PERFORMANCE_WARNING', message.data, currentTabId).catch(() => { });
    });


    onMessage('CHECK_MODEL_CACHED', async (message) => {
        const targetConfig = message.data;
        try {
            if (targetConfig.device === 'remote') {
                return true; // Remote models are always "cached"
            }
            if (targetConfig.model_id) {
                const allCacheNames = await caches.keys();
                console.log("[CHECK_MODEL_CACHED] Available caches:", allCacheNames, "Looking for:", targetConfig.model_id);

                for (const cacheName of allCacheNames) {
                    const cache = await caches.open(cacheName);
                    const keys = await cache.keys();

                    for (const req of keys) {
                        const url = req.url;
                        if (url.includes(targetConfig.model_id) || decodeURIComponent(url).includes(targetConfig.model_id)) {
                            console.log("[CHECK_MODEL_CACHED] Found model in cache:", url);
                            return true;
                        }
                    }
                }
                console.log("[CHECK_MODEL_CACHED] Model not found in any cache.");
            }
            return false;
        } catch (err) {
            console.error("Cache Check Error", err);
            return false;
        }
    });

    onMessage('CLEAR_CACHE', async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        } catch (err) {
            console.error("Failed to clear cache:", err);
            throw err;
        }
    });

    onMessage('GET_CACHED_MODELS', async () => {
        try {
            const allCacheNames = await caches.keys();
            const modelsSet = new Set();
            for (const cacheName of allCacheNames) {
                const cache = await caches.open(cacheName);
                const reqs = await cache.keys();
                reqs.forEach(req => {
                    const url = decodeURIComponent(req.url);
                    // Standard huggingface match
                    const hfMatch = url.match(/huggingface\.co\/([^/]+\/[^/]+)\//);
                    if (hfMatch && hfMatch[1]) modelsSet.add(hfMatch[1]);
                    // K2 match (assuming it has some identifiable pattern, or just raw URL)
                    if (cacheName.includes('k2')) {
                        const k2Match = url.match(/huggingface\.co\/([^/]+\/[^/]+)\//);
                        if (k2Match && k2Match[1]) modelsSet.add(k2Match[1]);
                        else if (!url.includes('huggingface.co')) modelsSet.add(url);
                    }
                });
            }
            return Array.from(modelsSet);
        } catch (err) {
            console.error("Failed to get cached models:", err);
            return [];
        }
    });

    onMessage('GET_STATE', () => {
        return {
            isRecording,
            currentProfileIndex: 0,
            vadStatus: isRecording ? 'quiet' : 'idle'
        };
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (isRecording && tabId === currentTabId && changeInfo.status === 'loading') {
            stopCapture();
        }
    });

    browser.tabs.onRemoved.addListener((tabId) => {
        if (isRecording && tabId === currentTabId) {
            stopCapture();
        }
    });
});
