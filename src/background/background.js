import contentScriptUrl from '../content/content.js?script';
const offscreenUrl = '/offscreen.html';
// background.js
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
        offscreenCreating = chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: 'Recording tab audio for transcription',
        });
        await offscreenCreating;
        offscreenCreating = null;
    }
}

function setIcon(active) {
    const path = active ? 'icons/icon.png' : 'icons/icon_idle.png';
    chrome.action.setIcon({ path: path }).catch(() => {
        // Ignore errors if icon setting fails
    });
}

async function startCapture(tabId, profile = null) {
    const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId,
    });

    currentTabId = tabId;

    let settings;

    if (profile) {
        // Construct settings from passed profile + global settings
        const globalSettings = await chrome.storage.sync.get({
            language: 'en',
            translationEnabled: false,
            targetLanguage: 'zh-TW',
            showOriginal: true
        });

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
        settings = await chrome.storage.sync.get({
            language: 'en',
            model_id: 'onnx-community/whisper-tiny',
            quantization: 'q4',
            asrBackend: 'webgpu',
            remoteEndpoint: '',
            remoteKey: '',
            translationEnabled: false,
            targetLanguage: 'zh-TW',
            showOriginal: true
        });
    }

    chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        target: 'offscreen',
        data: streamId,
        settings
    });

    isRecording = true;
}

async function stopCapture() {
    const tabIdToClear = currentTabId; // Capture current ID before clearing
    isRecording = false;
    currentTabId = null;
    setIcon(false);
    chrome.action.setBadgeText({ text: '' });

    // Notify content to remove overlay from the specific tab
    if (tabIdToClear) {
        try {
            chrome.tabs.sendMessage(tabIdToClear, {
                target: 'content',
                type: 'REMOVE_OVERLAY'
            }).catch(() => {
                // Ignore errors (tab might be closed)
            });
        } catch (e) {
            // Ignore
        }
    }

    // Close offscreen to release WebGPU resources
    try {
        await chrome.offscreen.closeDocument();
    } catch (err) {
        console.error('Error closing offscreen document:', err);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleMessage = async () => {
        if (message.type === 'REQUEST_DOWNLOAD') {
            // Download-only: create offscreen and forward download request
            await setupOffscreenDocument('offscreen.html');
            const profile = message.profile;
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_MODEL',
                target: 'offscreen',
                settings: {
                    model_id: profile.model_id,
                    quantization: profile.quantization,
                    asrBackend: profile.backend,
                    language: 'en'
                }
            });
        }
        else if (message.type === 'REQUEST_START') {
            await setupOffscreenDocument('offscreen.html');

            // Inject content script
            chrome.scripting.executeScript({
                target: { tabId: message.tabId },
                files: [contentScriptUrl]
            });

            // Pass profile if available
            await startCapture(message.tabId, message.profile);
        }
        else if (message.type === 'REQUEST_STOP') {
            await stopCapture();
        }
        else if (message.type === 'RECORDING_STARTED') {
            setIcon(true);
        }
        else if (message.type === 'DOWNLOAD_COMPLETE') {
            // Close offscreen after download to release memory
            try {
                await chrome.offscreen.closeDocument();
            } catch (err) {
                // Ignore if already closed
            }
        }
        else if (message.type === 'VAD_STATUS') {
            if (message.status === 'ACTIVE') {
                chrome.action.setBadgeText({ text: ' ' });
                chrome.action.setBadgeBackgroundColor({ color: '#ff7474ff' });
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        }
        else if (message.type === 'CHECK_MODEL_CACHED') {
            // Check if model files are in cache
            const profile = message.profile;
            try {
                if (profile.backend === 'remote') {
                    sendResponse({ cached: true });
                    return;
                }

                if (profile.model_id.includes('k2')) {
                    const cache = await caches.open('k2-models-v1');
                    const encoderUrl = `https://huggingface.co/${profile.model_id}/resolve/main/encoder-epoch-99-avg-1.int8.onnx`;
                    const match = await cache.match(encoderUrl);
                    sendResponse({ cached: !!match });
                    return;
                }

                // transformers.js models
                const keys = await caches.keys();
                for (const key of keys.filter(k => k.startsWith('transformers-cache'))) {
                    const cache = await caches.open(key);
                    const cachedRequests = await cache.keys();
                    const found = cachedRequests.some(req => req.url.includes(profile.model_id));
                    if (found) {
                        sendResponse({ cached: true });
                        return;
                    }
                }
                sendResponse({ cached: false });
            } catch (err) {
                console.warn('Cache check failed:', err);
                sendResponse({ cached: false });
            }
        }
        else if (message.type === 'GET_STATE') {
            sendResponse({ isRecording, currentTabId });
        }
    };

    handleMessage();

    // Relay to content
    if (message.target === 'content') {
        if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, message).catch(() => {
                // Ignore errors if content script isn't ready
            });
        }
    }

    return true; // Keep channel open for async response
});

// Auto-stop when tab is reloaded or closed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (isRecording && tabId === currentTabId && changeInfo.status === 'loading') {
        stopCapture();
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (isRecording && tabId === currentTabId) {
        stopCapture();
    }
});
