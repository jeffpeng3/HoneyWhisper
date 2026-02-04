// content.js

function createOverlay() {
    if (document.getElementById('webgpu-subtitle-overlay')) return;

    const div = document.createElement('div');
    div.id = 'webgpu-subtitle-overlay';
    div.style.position = 'fixed';
    div.style.bottom = '50px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    div.style.color = 'white';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '8px';
    div.style.fontSize = '24px';
    div.style.zIndex = '999999';
    div.style.pointerEvents = 'auto'; // Enable pointer events for dragging
    div.style.cursor = 'move'; // Indicate draggable
    div.style.userSelect = 'none'; // Prevent text selection while dragging
    div.style.textAlign = 'center';
    div.style.maxWidth = '80%';
    div.style.fontFamily = 'sans-serif';
    div.style.textShadow = '0px 0px 4px black';
    div.style.transition = 'opacity 0.3s';

    div.innerText = 'Initializing WebGPU Whisper...';

    // Drag Logic
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    div.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = div.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        div.style.bottom = 'auto'; // Disable bottom positioning
        div.style.transform = 'none'; // Disable center transform
        div.style.left = `${initialLeft}px`;
        div.style.top = `${initialTop}px`;
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; // Darken when dragging
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        div.style.left = `${initialLeft + dx}px`;
        div.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        }
    });

    // Load settings
    chrome.storage.sync.get('fontSize', (items) => {
        if (items.fontSize) {
            div.style.fontSize = `${items.fontSize}px`;
        }
    });

    document.body.appendChild(div);
}

chrome.runtime.onMessage.addListener((message) => {
    // console.log("Content script received message:", message); // Verbose log
    if (message.target === 'content') {
        if (message.type === 'SUBTITLE_UPDATE') {
            createOverlay();
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el) {
                console.log("Subtitle update:", message.text);
                el.innerText = message.text;
                el.style.display = 'block'; // Ensure visible
                if (!message.text) {
                    el.style.display = 'none';
                }
            } else {
                console.warn("Subtitle overlay element not found even after createOverlay()");
            }
        } else if (message.type === 'UPDATE_SETTINGS') {
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el && message.settings.fontSize) {
                el.style.fontSize = `${message.settings.fontSize}px`;
            }
        } else if (message.type === 'REMOVE_OVERLAY') {
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el) {
                el.style.display = 'none';
                el.innerText = '';
            }
        } else if (message.type === 'MODEL_LOADING') {
            const el = document.getElementById('webgpu-subtitle-overlay') || (createOverlay(), document.getElementById('webgpu-subtitle-overlay'));
            if (el) {
                el.style.display = 'block';
                if (message.data.status === 'progress') {
                    // Update progress bar or text
                    if (message.data.progress) {
                        el.innerText = `Loading: ${Math.round(message.data.progress)}%`;
                    }
                } else if (message.data.status === 'done') {
                    el.innerText = 'Model Ready';
                    setTimeout(() => {
                        if (el.innerText === 'Model Ready') {
                            el.innerText = '';
                            el.style.display = 'none';
                        }
                    }, 2000);
                } else if (message.data.status === 'initiate') {
                    el.innerText = 'Initiating Model...';
                }
            }
        }
    }
});
