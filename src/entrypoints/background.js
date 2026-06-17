import { sendMessage, onMessage } from '$lib/messaging';
import { getSettings } from '$lib/settings';


export default defineBackground(() => {
    const offscreenUrl = '/offscreen.html';
    let offscreenCreating;
    let isRecording = false;
    let modelReady = false;
    let currentTabId = null;

    async function hasOffscreenDocument() {
        const matchedClients = await clients.matchAll();
        return matchedClients.some(c => c.url.endsWith(offscreenUrl));
    }

    async function setupOffscreenDocument() {
        if (await hasOffscreenDocument()) return;
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
        browser.action.setIcon({ path }).catch(() => {});
    }

    async function startCapture(tabId) {
        const streamId = await browser.tabCapture.getMediaStreamId({
            targetTabId: tabId,
        });
        currentTabId = tabId;
        const settings = await getSettings();
        sendMessage('START_RECORDING', {
            streamId,
            pipelineConfig: settings,
        });
        isRecording = true;
    }

    async function stopCapture() {
        const tabIdToClear = currentTabId;
        isRecording = false;
        currentTabId = null;
        setIcon(false);
        browser.action.setBadgeText({ text: '' });

        if (tabIdToClear) {
            try {
                sendMessage('REMOVE_OVERLAY', undefined, { tabId: tabIdToClear });
            } catch (e) {}
        }

        try {
            await browser.offscreen.closeDocument();
        } catch (err) {
            console.error('Error closing offscreen document:', err);
        }
    }

    onMessage('INIT_MODEL', async () => {
        await setupOffscreenDocument();
    });

    onMessage('MODEL_READY', () => {
        modelReady = true;
    });

    onMessage('CLOSE_OFFSCREEN', async () => {
        try {
            await browser.offscreen.closeDocument();
        } catch (e) {}
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
            files: ['/content-scripts/content.js'],
        });
        await startCapture(targetTabId);
    });

    onMessage('REQUEST_STOP', async () => {
        await stopCapture();
    });

    onMessage('RECORDING_STARTED', () => {
        setIcon(true);
    });

    onMessage('ASR_ERROR', (message) => {
        console.error('ASR Error:', message.data.error);
    });

    onMessage('RESULT', (message) => {
        if (currentTabId) sendMessage('RESULT', message.data, currentTabId).catch(() => {});
    });

    onMessage('DOWNLOAD_PROGRESS', (message) => {
        if (currentTabId) sendMessage('DOWNLOAD_PROGRESS', message.data, currentTabId).catch(() => {});
    });

    onMessage('GET_STATE', () => {
        return { isRecording, currentTabId, modelReady };
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
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
