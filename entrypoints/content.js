import { onMessage } from '$lib/messaging';

export default defineContentScript({
    matches: ['<all_urls>'],
    registration: 'runtime',
    main() {
        if (window.honeyWhisperInitialized) return;
        window.honeyWhisperInitialized = true;

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

            // Load settings
            browser.storage.sync.get('fontSize', (items) => {
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

        // Set up message listener
        // Set up message listeners
        onMessage('RESULT', (message) => {
            createOverlay();
            const el = document.getElementById('webgpu-subtitle-overlay');
            const currentEl = document.getElementById('whisper-current');

            const data = message.data;

            // Check for pending history push (Trigger on ANY new text arrival)
            if (data.text && lastFinalText !== null) {
                historyBuffer.push(lastFinalText);
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
                lastFinalText = null;
            }

            // Update Current
            if (data.translatedText) {
                currentEl.innerHTML = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
            } else {
                currentEl.innerText = data.text;
            }
            el.style.display = 'block';

            // Finalize History (Store for NEXT push)
            if (data.isFinal && data.text) {
                // Update pending text (to be pushed when NEXT subtitle arrives)
                if (data.translatedText) {
                    lastFinalText = `<div>${data.translatedText}</div><div style="font-size: 0.8em; opacity: 0.8;">${data.text}</div>`;
                } else {
                    lastFinalText = data.text;
                }
            }

            // Hide if empty
            if (!data.text && historyBuffer.length === 0 && !lastFinalText) {
                el.style.display = 'none';
            }

            updateHistoryDisplay(); // Ensure sync
        });

        onMessage('UPDATE_SETTINGS', (message) => {
            const el = document.getElementById('webgpu-subtitle-overlay');
            const settings = message.data.settings;
            if (el && settings.fontSize) {
                el.style.fontSize = `${settings.fontSize}px`;
            }
            if (settings.historyLines !== undefined) {
                maxHistoryLines = parseInt(settings.historyLines);
                // Trim existing buffer if needed
                while (historyBuffer.length > maxHistoryLines) {
                    historyBuffer.shift();
                }
                updateHistoryDisplay();
            }
        });

        onMessage('REMOVE_OVERLAY', () => {
            const el = document.getElementById('webgpu-subtitle-overlay');
            if (el) {
                el.style.display = 'none';
                const currentEl = document.getElementById('whisper-current');
                if (currentEl) currentEl.innerText = '';
                historyBuffer = [];
                lastFinalText = null;
                updateHistoryDisplay();
            }
        });

        onMessage('DOWNLOAD_PROGRESS', (message) => {
            const data = message.data;
            const el = document.getElementById('webgpu-subtitle-overlay') || (createOverlay(), document.getElementById('webgpu-subtitle-overlay'));
            const currentEl = document.getElementById('whisper-current');

            if (el && currentEl) {
                el.style.display = 'block';
                if (data.status === 'progress' || (data.progress && data.progress > 0 && data.progress < 100)) {
                    if (data.progress) {
                        currentEl.innerText = `Loading: ${Math.round(data.progress)}%`;
                    }
                } else if (data.status === 'done' || data.progress === 100) {
                    currentEl.innerText = 'Model Ready';
                    setTimeout(() => {
                        if (currentEl.innerText === 'Model Ready') {
                            currentEl.innerText = '';
                            if (historyBuffer.length === 0) el.style.display = 'none';
                        }
                    }, 2000);
                } else if (data.status === 'initiate') {
                    currentEl.innerText = 'Initiating Model...';
                }
            }
        });

        onMessage('PERFORMANCE_WARNING', (message) => {
            const el = document.getElementById('webgpu-subtitle-overlay') || (createOverlay(), document.getElementById('webgpu-subtitle-overlay'));
            const warningId = 'whisper-perf-warning';
            let warningEl = document.getElementById(warningId);

            if (el) {
                el.style.display = 'block';
                if (!warningEl) {
                    warningEl = document.createElement('div');
                    warningEl.id = warningId;
                    warningEl.style.color = '#ff4444';
                    warningEl.style.fontSize = '0.8em';
                    warningEl.style.marginBottom = '5px';
                    warningEl.style.fontWeight = 'bold';
                    el.insertBefore(warningEl, el.firstChild);
                }

                warningEl.innerText = "⚠️ System Overload: Processing Busy";

                // Auto-hide
                setTimeout(() => {
                    if (document.getElementById(warningId)) {
                        warningEl.remove();
                    }
                }, 3000);
            }
        });

        // Initial Settings Load
        browser.storage.sync.get(['historyLines'], (items) => {
            if (items.historyLines !== undefined) {
                maxHistoryLines = parseInt(items.historyLines);
            }
        });
    }
});
