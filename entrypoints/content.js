import { onMessage } from '$lib/messaging';
import { getSettings } from '$lib/settings';
import { i18n } from '#i18n';

export default defineContentScript({
    matches: ['<all_urls>'],
    registration: 'runtime',
    async main() {
        if (window.honeyWhisperInitialized) return;
        window.honeyWhisperInitialized = true;

        let overlayEl = null;
        let historyEl = null;
        let currentEl = null;

        let historyBuffer = [];
        let maxHistoryLines = 1;
        let lastFinalText = null;

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
                fontSize: '24px',
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

            // Cache child elements
            historyEl = document.getElementById('whisper-history');
            currentEl = document.getElementById('whisper-current');

            makeDraggable(overlayEl);

            // Load settings
            const settings = await getSettings();
            if (settings.fontSize) {
                overlayEl.style.fontSize = `${settings.fontSize}px`;
            }
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

            if (data.text && lastFinalText !== null) {
                historyBuffer.push(lastFinalText);
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
                lastFinalText = null;
            }

            if (data.translatedText) {
                currentEl.innerHTML = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
            } else {
                currentEl.innerText = data.text;
            }
            overlayEl.style.display = 'block';

            if (data.isFinal && data.text) {
                if (data.translatedText) {
                    lastFinalText = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
                } else {
                    lastFinalText = data.text;
                }
            }

            if (!data.text && historyBuffer.length === 0 && !lastFinalText) {
                overlayEl.style.display = 'none';
            }

            updateHistoryDisplay();
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
                lastFinalText = null;
                updateHistoryDisplay();
            }
        }

        function handleDownloadProgress(message) {
            const data = message.data;
            if (!overlayEl) createOverlay();

            if (overlayEl && currentEl) {
                overlayEl.style.display = 'block';
                if (data.status === 'progress' || (data.progress && data.progress > 0 && data.progress < 100)) {
                    if (data.progress) {
                        currentEl.innerText = `${i18n.t('content.loading')}${Math.round(data.progress)}%`;
                    }
                } else if (data.status === 'done' || data.progress === 100) {
                    currentEl.innerText = i18n.t('content.modelReady');
                    setTimeout(() => {
                        if (currentEl.innerText === i18n.t('content.modelReady')) {
                            currentEl.innerText = '';
                            if (historyBuffer.length === 0) overlayEl.style.display = 'none';
                        }
                    }, 2000);
                } else if (data.status === 'initiate') {
                    currentEl.innerText = i18n.t('content.initiatingModel');
                }
            }
        }

        function handlePerformanceWarning() {
            if (!overlayEl) createOverlay();
            const warningId = 'whisper-perf-warning';
            let warningEl = document.getElementById(warningId);

            if (overlayEl) {
                overlayEl.style.display = 'block';
                if (!warningEl) {
                    warningEl = document.createElement('div');
                    warningEl.id = warningId;
                    warningEl.style.color = '#ff4444';
                    warningEl.style.fontSize = '0.8em';
                    warningEl.style.marginBottom = '5px';
                    warningEl.style.fontWeight = 'bold';
                    overlayEl.insertBefore(warningEl, overlayEl.firstChild);
                }

                warningEl.innerText = i18n.t('content.systemOverload');

                setTimeout(() => {
                    const elToRemove = document.getElementById(warningId);
                    if (elToRemove) {
                        elToRemove.remove();
                    }
                }, 3000);
            }
        }

        // Set up message listeners
        onMessage('RESULT', handleResult);
        onMessage('UPDATE_SETTINGS', handleUpdateSettings);
        onMessage('REMOVE_OVERLAY', handleRemoveOverlay);
        onMessage('DOWNLOAD_PROGRESS', handleDownloadProgress);
        onMessage('PERFORMANCE_WARNING', handlePerformanceWarning);

        // Initial Settings Load
        const initialSettings = await getSettings();
        if (initialSettings.historyLines !== undefined) {
            maxHistoryLines = parseInt(initialSettings.historyLines);
        }
    }
});
