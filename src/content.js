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
    div.style.pointerEvents = 'none'; // Click through
    div.style.textAlign = 'center';
    div.style.maxWidth = '80%';
    div.style.fontFamily = 'sans-serif';
    div.style.textShadow = '0px 0px 4px black';

    div.innerText = 'Initializing WebGPU Whisper...';

    document.body.appendChild(div);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.target === 'content' && message.type === 'SUBTITLE_UPDATE') {
        createOverlay();
        const el = document.getElementById('webgpu-subtitle-overlay');
        if (el) {
            el.innerText = message.text;
        }
    }
});
