import contentScriptUrl from '../content/content.js?script';
const offscreenUrl = '/offscreen.html';
// background.js
let offscreenCreating;
let isRecording = false;
let currentTabId = null;

// Check if offscreen document exists
async function hasOffscreenDocument() {
    const matchedClients = await clients.matchAll();
    return matchedClients.some(c => c.url === offscreenUrl);
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
            targetLanguage: 'zh-TW'
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
            targetLanguage: 'zh-TW'
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
    try {
        chrome.runtime.sendMessage({
            type: 'STOP_RECORDING',
            target: 'offscreen'
        });
    } catch (e) {
        // Ignore sending error if offscreen is gone
    }
    isRecording = false;
    currentTabId = null;
    setIcon(false);

    // Close offscreen to release WebGPU resources
    try {
        await chrome.offscreen.closeDocument();
    } catch (err) {
        console.error('Error closing offscreen document:', err);
    }

    // Notify content to remove overlay
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                target: 'content',
                type: 'REMOVE_OVERLAY'
            }).catch(() => {
                // Ignore errors
            });
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleMessage = async () => {
        if (message.type === 'REQUEST_START') {
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
        else if (message.type === 'GET_STATE') {
            sendResponse({ isRecording, currentTabId });
        }
    };

    handleMessage();

    // Relay to content
    if (message.target === 'content') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {
                    // Ignore errors if content script isn't ready
                });
            }
        });
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
