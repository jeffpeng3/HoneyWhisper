
// State Management
const btnState = document.getElementById('btnState');
const statusBadge = document.getElementById('statusBadge');
let isRecording = false;
let autoCloseOnReady = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Restore Settings
    chrome.storage.sync.get({ language: 'en', fontSize: '24', model_id: 'onnx-community/whisper-tiny' }, (items) => {
        document.getElementById('language').value = items.language;
        document.getElementById('fontSize').value = items.fontSize;
        if (items.model_id) document.getElementById('modelId').value = items.model_id;
        updatePreview(items.fontSize);
    });

    // Check recording state (we need to ask background)
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response && response.isRecording) {
        setRecordingState(true, response.currentTabId);
    }
});

// Settings Handlers
const updateSettings = () => {
    const language = document.getElementById('language').value;
    const fontSize = document.getElementById('fontSize').value;
    const model_id = document.getElementById('modelId').value;

    chrome.storage.sync.set({ language, fontSize, model_id });

    // Notify active tabs about font size change immediately
    chrome.runtime.sendMessage({
        target: 'content',
        type: 'UPDATE_SETTINGS',
        settings: { fontSize }
    });

    // Notify offscreen about settings change
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'UPDATE_SETTINGS',
        settings: { language, model_id }
    });
};

document.getElementById('modelId').addEventListener('change', updateSettings);
document.getElementById('language').addEventListener('change', updateSettings);
document.getElementById('fontSize').addEventListener('input', (e) => {
    updatePreview(e.target.value);
    updateSettings(); // Debounce this in production, but okay for local
});

const updatePreview = (size) => {
    document.getElementById('fontSizePreview').style.fontSize = `${size}px`;
};

// Control Handlers
btnState.addEventListener('click', async () => {
    if (!isRecording) {
        // Start
        // We need to get the active tab first
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.runtime.sendMessage({ type: 'REQUEST_START', tabId: tab.id });
            setRecordingState(true);
            autoCloseOnReady = true;
        }
    } else {
        // Stop
        chrome.runtime.sendMessage({ type: 'REQUEST_STOP' });
        setRecordingState(false);
    }
});

const tabLink = document.getElementById('tabLink');
tabLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const tabId = parseInt(tabLink.dataset.tabId);
    if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        if (tab) {
            chrome.tabs.update(tab.id, { active: true });
            chrome.windows.update(tab.windowId, { focused: true });
        }
    }
});

async function setRecordingState(recording, tabId = null) {
    isRecording = recording;
    const activeTabInfo = document.getElementById('activeTabInfo');

    if (recording) {
        btnState.className = 'btn-main btn-stop';
        btnState.innerText = 'Stop Captioning';
        statusBadge.className = 'status-badge status-recording';
        statusBadge.innerText = 'Recording';

        if (tabId) {
            try {
                const tab = await chrome.tabs.get(tabId);
                tabLink.innerText = tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title;
                tabLink.dataset.tabId = tabId;
                activeTabInfo.style.display = 'block';
            } catch (e) {
                activeTabInfo.style.display = 'none';
            }
        }
    } else {
        btnState.className = 'btn-main btn-start';
        btnState.innerText = 'Start Captioning';
        statusBadge.className = 'status-badge';
        statusBadge.innerText = 'Ready';
        activeTabInfo.style.display = 'none';
    }
}

// Progress Handler
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MODEL_LOADING') {
        const container = document.getElementById('progressContainer');
        const bar = document.getElementById('progressBar');
        const text = document.getElementById('progressText');
        const percent = document.getElementById('progressPercent');

        if (message.data.status === 'progress') {
            container.style.display = 'block';
            // data has checkfile, file, loaded, total, progress, name, status
            // If message.data.file starts with 'onnx', it's the model
            // Simple percent logic
            const p = Math.round(message.data.progress || 0);
            bar.style.width = `${p}%`;
            percent.innerText = `${p}%`;
            text.innerText = `Loading ${message.data.file || 'Model'}...`;
        } else if (message.data.status === 'done') {
            bar.style.width = '100%';
            percent.innerText = '100%';
            text.innerText = 'Ready!';

            if (autoCloseOnReady) {
                setTimeout(() => {
                    window.close();
                }, 800);
            } else {
                setTimeout(() => {
                    container.style.display = 'none';
                }, 2000);
            }
        } else if (message.data.status === 'initiate') {
            container.style.display = 'block';
            bar.style.width = '0%';
            percent.innerText = '0%';
            text.innerText = 'Initializing...';
        } else if (message.data.status === 'error') {
            container.style.display = 'block';
            bar.style.background = '#ef4444';
            bar.style.width = '100%';
            text.innerText = 'Error: ' + message.data.error;
        }
    }
});

document.getElementById('btnClearCache').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all downloaded models?')) {
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'CLEAR_CACHE' });
    }
});
