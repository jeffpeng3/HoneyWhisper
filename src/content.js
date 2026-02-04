// content.js

function createOverlay() {
    if (document.getElementById('webgpu-subtitle-overlay')) return;

    const div = document.createElement('div');
    div.id = 'webgpu-subtitle-overlay';
    div.style.position = 'fixed';
    div.style.bottom = '100px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    div.style.color = 'white';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '8px';
    div.style.fontSize = '24px';
    div.style.lineHeight = '1.4';
    div.style.zIndex = '999999';
    div.style.pointerEvents = 'auto'; // Enable pointer events for dragging
    div.style.cursor = 'move'; // Indicate draggable
    div.style.userSelect = 'none'; // Prevent text selection while dragging
    div.style.textAlign = 'center';
    div.style.width = 'max-content'; // Force width to fit content
    div.style.maxWidth = '90vw';     // Limit to 90% of screen width
    div.style.fontFamily = 'sans-serif';
    div.style.textShadow = '0px 0px 4px black';
    div.style.transition = 'opacity 0.3s';

    div.innerHTML = '<div id="whisper-history" style="color: #bbb; font-size: 0.85em; margin-bottom: 4px;"></div><div id="whisper-current">Initializing HoneyWhisper...</div>';

    // Drag Logic
    let isMouseDown = false;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    const DRAG_THRESHOLD = 5;

    div.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        if (!isDragging) {
            // Check threshold
            if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
                isDragging = true;

                // Initialize dragging state
                const rect = div.getBoundingClientRect();

                // For centered expansion, we track the CENTER X, not the left X
                initialLeft = rect.left + (rect.width / 2); // Center X
                initialTop = rect.top;

                div.style.bottom = 'auto'; // Disable bottom positioning
                // Keep transform center-aligned!
                div.style.transform = 'translateX(-50%)';

                div.style.left = `${initialLeft}px`;
                div.style.top = `${initialTop}px`;
                div.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; // Darken when dragging
            }
        }

        if (isDragging) {
            // Update position based on center
            div.style.left = `${initialLeft + deltaX}px`;
            div.style.top = `${initialTop + deltaY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            if (isDragging) {
                isDragging = false;
                div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        }
    });

    // Reset position on double click
    div.addEventListener('dblclick', () => {
        div.style.bottom = '100px';
        div.style.top = 'auto';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    });

    // Reset position on double click
    div.addEventListener('dblclick', () => {
        div.style.bottom = '100px';
        div.style.top = 'auto';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    });

    // Load settings
    chrome.storage.sync.get('fontSize', (items) => {
        if (items.fontSize) {
            div.style.fontSize = `${items.fontSize}px`;
        }
    });

    document.body.appendChild(div);
}

// Load Settings
let historyBuffer = [];
let maxHistoryLines = 1;
let lastFinalText = null;

function updateHistoryDisplay() {
    const historyEl = document.getElementById('whisper-history');
    if (historyEl) {
        historyEl.innerHTML = historyBuffer
            .map(line => `<div>${line}</div>`)
            .join('');
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.target === 'content') {
        if (message.type === 'SUBTITLE_UPDATE') {
            createOverlay();
            const el = document.getElementById('webgpu-subtitle-overlay');
            const currentEl = document.getElementById('whisper-current');

            // Check for initial setting load if first run (lazy load)
            if (message.settings && message.settings.historyLines !== undefined) {
                maxHistoryLines = parseInt(message.settings.historyLines);
            }

            if (el && currentEl) {
                // Update Current
                currentEl.innerText = message.text;
                el.style.display = 'block';

                // Finalize History
                if (message.isFinal && message.text) {
                    // Only push the PREVIOUS final text to history
                    if (lastFinalText !== null) {
                        historyBuffer.push(lastFinalText);
                        while (historyBuffer.length > maxHistoryLines) {
                            historyBuffer.shift();
                        }
                        updateHistoryDisplay();
                    }
                    // Update pending text
                    lastFinalText = message.text;
                }

                // Hide if empty
                if (!message.text && historyBuffer.length === 0 && !lastFinalText) {
                    el.style.display = 'none';
                }

                updateHistoryDisplay(); // Ensure sync
            }
        } else if (message.type === 'UPDATE_SETTINGS') {
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el && message.settings.fontSize) {
                el.style.fontSize = `${message.settings.fontSize}px`;
            }
            if (message.settings.historyLines !== undefined) {
                maxHistoryLines = parseInt(message.settings.historyLines);
                // Trim existing buffer if needed
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
            }
        } else if (message.type === 'REMOVE_OVERLAY') {
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el) {
                el.style.display = 'none';
                const currentEl = document.getElementById('whisper-current');
                if (currentEl) currentEl.innerText = '';
                historyBuffer = [];
                lastFinalText = null;
                updateHistoryDisplay();
            }
        } else if (message.type === 'MODEL_LOADING') {
            const el = document.getElementById('webgpu-subtitle-overlay') || (createOverlay(), document.getElementById('webgpu-subtitle-overlay'));
            const currentEl = document.getElementById('whisper-current');

            if (el && currentEl) {
                el.style.display = 'block';
                if (message.data.status === 'progress') {
                    if (message.data.progress) {
                        currentEl.innerText = `Loading: ${Math.round(message.data.progress)}%`;
                    }
                } else if (message.data.status === 'done') {
                    currentEl.innerText = 'Model Ready';
                    setTimeout(() => {
                        if (currentEl.innerText === 'Model Ready') {
                            currentEl.innerText = '';
                            if (historyBuffer.length === 0) el.style.display = 'none';
                        }
                    }, 2000);
                } else if (message.data.status === 'initiate') {
                    currentEl.innerText = 'Initiating Model...';
                }
            }
        }
    }
});

// Initial Settings Load
chrome.storage.sync.get(['historyLines'], (items) => {
    if (items.historyLines !== undefined) {
        maxHistoryLines = parseInt(items.historyLines);
    }
});
