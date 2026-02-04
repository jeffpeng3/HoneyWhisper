// background.js
let offscreenCreating;
let isRecording = false;

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

    // Get settings
    const { language } = await chrome.storage.sync.get({ language: 'en' });

    // Send streamId to offscreen document
    chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        target: 'offscreen',
        data: streamId,
        language
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

    // Close offscreen to release WebGPU resources
    if (await hasOffscreenDocument('src/offscreen.html')) {
        try {
            await chrome.offscreen.closeDocument();
        } catch (err) {
            console.error('Error closing offscreen document:', err);
        }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleMessage = async () => {
        if (message.type === 'REQUEST_START') {
            await setupOffscreenDocument('src/offscreen.html');

            // Inject content script
            chrome.scripting.executeScript({
                target: { tabId: message.tabId },
                files: ['assets/content.js']
            });

            await startCapture(message.tabId);
        }
        else if (message.type === 'REQUEST_STOP') {
            await stopCapture();
        }
        else if (message.type === 'GET_STATE') {
            sendResponse({ isRecording });
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
