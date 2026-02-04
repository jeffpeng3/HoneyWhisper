// background.js
let offscreenCreating;

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

    // Send streamId to offscreen document
    chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        target: 'offscreen',
        data: streamId
    });
}

chrome.action.onClicked.addListener(async (tab) => {
    await setupOffscreenDocument('src/offscreen.html');

    // Inject content script if not already there (optional, but good for safety)
    // Actually, manifest injects it, but we can programmatically inject to be sure
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['assets/content.js']
    });

    await startCapture(tab.id);
});

// Relay messages from offscreen to content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'content') {
        // Find active tab or specific tab to send to
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        });
    }
});
