import { onMessage } from '$lib/messaging';
import { uiConfig } from '$lib/settings/index.ts';
import { i18n } from '#i18n';

export default defineContentScript({
    matches: ['<all_urls>'],
    registration: 'runtime',
    async main() {
        if (window.honeyWhisperInitialized) return;
        window.honeyWhisperInitialized = true;

        await uiConfig.load();

        let overlayEl = null;
        let historyEl = null;
        let currentEl = null;

        let historyBuffer = [];
        let maxHistoryLines = parseInt(uiConfig.historyLines) || 1;

        async function createOverlay() {
            if (overlayEl) return;

            overlayEl = document.createElement('div');
            overlayEl.id = 'webgpu-subtitle-overlay';
            Object.assign(overlayEl.style, {
                position: 'fixed',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: `${uiConfig.fontSize}px`,
                lineHeight: '1.4',
                zIndex: '999999',
                pointerEvents: 'auto',
                cursor: 'move',
                userSelect: 'none',
                textAlign: 'center',
                width: 'max-content',
                maxWidth: '90vw',
                fontFamily: 'sans-serif',
                textShadow: '0px 0px 4px black',
                transition: 'opacity 0.3s'
            });

            overlayEl.innerHTML = `<div id="whisper-history" style="color: #bbb; font-size: 0.85em; margin-bottom: 4px;"></div><div id="whisper-current">${i18n.t('content.initializing')}</div>`;

            document.body.appendChild(overlayEl);

            historyEl = document.getElementById('whisper-history');
            currentEl = document.getElementById('whisper-current');

            makeDraggable(overlayEl);
        }

        function makeDraggable(element) {
            let isMouseDown = false;
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;
            const DRAG_THRESHOLD = 5;

            element.addEventListener('mousedown', (e) => {
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
                    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
                        isDragging = true;
                        const rect = element.getBoundingClientRect();
                        initialLeft = rect.left + (rect.width / 2);
                        initialTop = rect.top;
                        element.style.bottom = 'auto';
                        element.style.transform = 'translateX(-50%)';
                        element.style.left = `${initialLeft}px`;
                        element.style.top = `${initialTop}px`;
                        element.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                    }
                }
                if (isDragging) {
                    element.style.left = `${initialLeft + deltaX}px`;
                    element.style.top = `${initialTop + deltaY}px`;
                }
            });

            document.addEventListener('mouseup', () => {
                if (isMouseDown) {
                    isMouseDown = false;
                    if (isDragging) {
                        isDragging = false;
                        element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    }
                }
            });

            element.addEventListener('dblclick', () => {
                element.style.bottom = '100px';
                element.style.top = 'auto';
                element.style.left = '50%';
                element.style.transform = 'translateX(-50%)';
                element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            });
        }

        function updateHistoryDisplay() {
            if (historyEl) {
                historyEl.innerHTML = historyBuffer
                    .map(line => `<div>${line}</div>`)
                    .join('');
            }
        }

        function handleResult(message) {
            if (!overlayEl) createOverlay();

            const data = message.data;

            if (data.isFinal && data.text) {
                let historyEntry;
                if (data.translatedText) {
                    historyEntry = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
                } else {
                    historyEntry = data.text;
                }
                historyBuffer.push(historyEntry);
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
            }

            if (data.translatedText) {
                currentEl.innerHTML = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
            } else {
                currentEl.innerText = data.text;
            }
            overlayEl.style.display = 'block';

            if (!data.text && historyBuffer.length === 0) {
                overlayEl.style.display = 'none';
            }
        }

        function handleUpdateSettings(message) {
            const settings = message.data.settings;
            if (overlayEl && settings.fontSize) {
                overlayEl.style.fontSize = `${settings.fontSize}px`;
            }
            if (settings.historyLines !== undefined) {
                maxHistoryLines = parseInt(settings.historyLines);
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
            }
        }

        function handleRemoveOverlay() {
            if (overlayEl) {
                overlayEl.style.display = 'none';
                if (currentEl) currentEl.innerText = '';
                historyBuffer = [];
                updateHistoryDisplay();
            }
        }

        uiConfig.onChange(() => {
            if (overlayEl) {
                overlayEl.style.fontSize = `${uiConfig.fontSize}px`;
            }
            maxHistoryLines = parseInt(uiConfig.historyLines) || 1;
            while (historyBuffer.length > maxHistoryLines) {
                historyBuffer.shift();
            }
            updateHistoryDisplay();
        });

        onMessage('RESULT', handleResult);
        onMessage('UPDATE_SETTINGS', handleUpdateSettings);
        onMessage('REMOVE_OVERLAY', handleRemoveOverlay);
    }
});
