// Saves options to chrome.storage
const saveOptions = () => {
    const language = document.getElementById('language').value;
    // const task = document.getElementById('task').value;
    const fontSize = document.getElementById('fontSize').value;

    chrome.storage.sync.set(
        { language, fontSize },
        () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.style.opacity = '1';
            setTimeout(() => {
                status.style.opacity = '0';
            }, 1500);

            // Notify active tabs about font size change immediately
            chrome.runtime.sendMessage({
                target: 'content',
                type: 'UPDATE_SETTINGS',
                settings: { fontSize }
            });
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        { language: 'en', fontSize: '24' },
        (items) => {
            document.getElementById('language').value = items.language;
            // document.getElementById('task').value = items.task;
            document.getElementById('fontSize').value = items.fontSize;

            updatePreview(items.fontSize);
        }
    );
};

const updatePreview = (size) => {
    const preview = document.getElementById('fontSizePreview');
    preview.style.fontSize = `${size}px`;
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('fontSize').addEventListener('input', (e) => updatePreview(e.target.value));
