// background.js
let offscreenCreating;
let isRecording = false;
let currentTabId = null;

// Check if offscreen document exists
async function hasOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const matchedClients = await clients.matchAll();
    return matchedClients.some(c => c.url === offscreenUrl);
}

async function setupOffscreenDocument(path) {
    if (await hasOffscreenDocument(path)) return;

    // Create offscreen document
    if (offscreenCreating) {
        await offscreenCreating;
    } else {
        offscreenCreating = chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: 'Recording tab audio for transcription',
        });
        await offscreenCreating;
        offscreenCreating = null;
    }
}

async function startCapture(tabId) {
    const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId,
    });

    currentTabId = tabId;

    // Get settings
    const { language, model_id, quantization } = await chrome.storage.sync.get({
        language: 'en',
        model_id: 'onnx-community/whisper-tiny',
        quantization: 'q4'
    });

    // Send streamId to offscreen document
    chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        target: 'offscreen',
        data: streamId,
        language,
        model_id,
        quantization
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

    // Close offscreen to release WebGPU resources
    if (await hasOffscreenDocument('src/offscreen/index.html')) {
        try {
            await chrome.offscreen.closeDocument();
        } catch (err) {
            console.error('Error closing offscreen document:', err);
        }
    } else {
        console.log('Offscreen document not found');
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
            await setupOffscreenDocument('src/offscreen/index.html');

            // Inject content script
            chrome.scripting.executeScript({
                target: { tabId: message.tabId },
                files: ['src/content/index.js']
            });

            await startCapture(message.tabId);
        }
        else if (message.type === 'REQUEST_STOP') {
            await stopCapture();
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

    // Relay to offscreen if needed (though runtime messages are broadcast, sometimes explicit targeting helps clarify intent)
    // Actually runtime.sendMessage from popup goes to background. Does it go to offscreen?
    // Yes, runtime.sendMessage goes to all extension pages/frames.
    // So if Popup sends it, Offscreen hears it.
    // But let's verification popup.js behavior.

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
