<script>
  import { onMount, onDestroy } from 'svelte';

  // State
  let isRecording = false;
  let autoCloseOnReady = false;
  let models = [];
  let modelSelect = '';
  let customModelId = '';
  let quantization = 'q4';
  let language = 'en';
  let historyLines = 1;
  let fontSize = 24;
  let fontSizePreviewText = 'Abc';

  // Active Tab Info
  let showActiveTabInfo = false;
  let activeTabTitle = 'Tab Name';
  let activeTabId = null;

  // Progress Bar
  let showProgress = false;
  let progressPercent = 0;
  let progressText = 'Loading Model...';
  let progressStatus = 'initiate'; // initiate, progress, done, error
  let progressError = '';

  // Debug
  let installedModels = [];
  let showInstalledModels = false;

  onMount(async () => {
    // 1. Fetch Model List
    try {
      let res;
      try {
        res = await fetch('https://raw.githubusercontent.com/jeffpeng3/HoneyWhisper/master/public/models.json');
        if (!res.ok) throw new Error('Network response not ok');
      } catch (err) {
        console.warn('Failed to fetch from GitHub, falling back to local models.json', err);
        res = await fetch(chrome.runtime.getURL('models.json'));
      }
      models = await res.json();
    } catch (e) {
      console.error('Critical Error loading models:', e);
      // Fallback if absolutely everything fails
      models = [{ id: 'onnx-community/whisper-tiny', name: 'Tiny (Fallback)' }];
    }

    // 2. Restore Settings
    chrome.storage.sync.get({ 
      language: 'en', 
      fontSize: '24', 
      model_id: 'onnx-community/whisper-tiny', 
      historyLines: 1, 
      quantization: 'q4' 
    }, (items) => {
      language = items.language;
      fontSize = parseInt(items.fontSize);
      historyLines = parseInt(items.historyLines);
      quantization = items.quantization;

      // Check if saved model_id is in the list
      const knownModelIds = models.map(m => m.id);
      if (items.model_id && !knownModelIds.includes(items.model_id)) {
        modelSelect = 'custom';
        customModelId = items.model_id;
      } else {
        modelSelect = items.model_id || (models[0] ? models[0].id : '');
      }
    });

    // 3. Check recording state
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response && response.isRecording) {
        setRecordingState(true, response.currentTabId);
      }
    } catch (e) {
      // Background might not be ready
    }

    // 4. Message Listeners
    chrome.runtime.onMessage.addListener(handleMessage);
  });

  onDestroy(() => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  });

  function handleMessage(message) {
    if (message.type === 'MODEL_LOADING') {
      showProgress = true;
      progressStatus = message.data.status;

      if (message.data.status === 'progress') {
        progressPercent = Math.round(message.data.progress || 0);
        progressText = `Loading ${message.data.file || 'Model'}...`;
      } else if (message.data.status === 'done') {
        progressPercent = 100;
        progressText = 'Whisper Model Ready!';
        if (!autoCloseOnReady) {
          setTimeout(() => { showProgress = false; }, 2000);
        }
      } else if (message.data.status === 'initiate') {
        progressPercent = 0;
        progressText = 'Initializing...';
      } else if (message.data.status === 'error') {
        progressText = 'Error: ' + message.data.error;
        progressError = message.data.error;
      }
    } else if (message.type === 'RECORDING_STARTED') {
      progressText = 'Recording Active!';
      if (autoCloseOnReady) {
        setTimeout(() => { window.close(); }, 800);
      }
    }
  }

  // Reactive Settings Update
  $: updateSettings(language, fontSize, modelSelect, customModelId, historyLines, quantization);

  function updateSettings() {
    // Determine actual model ID
    let finalModelId = modelSelect === 'custom' ? customModelId : modelSelect;
    
    // Guard against initial run before settings are loaded
    if (!finalModelId) return;

    chrome.storage.sync.set({ 
      language, 
      fontSize: String(fontSize), 
      model_id: finalModelId, 
      historyLines, 
      quantization 
    });

    // Notify active tabs
    chrome.runtime.sendMessage({
      target: 'content',
      type: 'UPDATE_SETTINGS',
      settings: { fontSize: String(fontSize), historyLines }
    }).catch(() => {}); // Content script might not be there

    // Notify offscreen
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'UPDATE_SETTINGS',
      settings: { language, model_id: finalModelId, quantization }
    }).catch(() => {});
  }

  async function toggleRecording() {
    if (!isRecording) {
      // Start
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
  }

  async function setRecordingState(recording, tabId = null) {
      isRecording = recording;

      if (recording && tabId) {
          try {
              const tab = await chrome.tabs.get(tabId);
              activeTabTitle = tab.title.length > 25 ? tab.title.substring(0, 25) + '...' : tab.title;
              activeTabId = tabId;
              showActiveTabInfo = true;
          } catch (e) {
              showActiveTabInfo = false;
          }
      } else if (!recording) {
          showActiveTabInfo = false;
      }
  }

  async function activateTab(e) {
      e.preventDefault();
      if (activeTabId) {
          const tab = await chrome.tabs.get(activeTabId);
          if (tab) {
              chrome.tabs.update(tab.id, { active: true });
              chrome.windows.update(tab.windowId, { focused: true });
          }
      }
  }

  async function clearCache() {
    if (confirm('Are you sure you want to delete all downloaded models?')) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            alert(`Cleared ${keys.length} cache(s).`);
            installedModels = []; // Clear UI
        } catch (err) {
            alert('Error clearing cache: ' + err.message);
        }
    }
  }

  async function listModels() {
    installedModels = []; // Reset
    try {
        if (await caches.has('transformers-cache')) {
            const cache = await caches.open('transformers-cache');
            const requests = await cache.keys();
            const modelsSet = new Set();

            requests.forEach(req => {
                const match = req.url.match(/huggingface\.co\/([^/]+\/[^/]+)\//);
                if (match && match[1]) {
                    modelsSet.add(match[1]);
                }
            });

            if (modelsSet.size > 0) {
                installedModels = Array.from(modelsSet);
            } else {
                installedModels = ['Cache found but no recognizable models identified.'];
            }
        } else {
            const keys = await caches.keys();
            if(keys.length > 0) {
              installedModels = ['No standard cache found. Available caches:', ...keys];
            } else {
              installedModels = ['No caches found.'];
            }
        }
        showInstalledModels = true;
    } catch (err) {
        installedModels = ['Error parsing cache: ' + err.message];
        showInstalledModels = true;
    }
  }
</script>

<main>
  <h1>
    HoneyWhisper
    <span class="status-badge {isRecording ? 'status-recording' : ''}">
      {isRecording ? 'Recording' : 'Ready'}
    </span>
  </h1>

  {#if showActiveTabInfo}
    <div class="active-tab-info">
      Capturing: <button class="btn-link" on:click={activateTab}>{activeTabTitle}</button>
    </div>
  {/if}

  {#if showProgress}
    <div class="progress-container">
      <div class="progress-header">
        <span>{progressText}</span>
        <span>{progressPercent}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" 
             style="width: {progressPercent}%; background: {progressStatus === 'error' ? '#ef4444' : '#3b82f6'}">
        </div>
      </div>
    </div>
  {/if}

  <button class="btn-main {isRecording ? 'btn-stop' : 'btn-start'}" on:click={toggleRecording}>
    <span>{isRecording ? 'Stop Captioning' : 'Start Captioning'}</span>
  </button>

  <div class="settings">
    <label for="modelId">Model (onnx-community)</label>
    <select id="modelId" bind:value={modelSelect}>
      {#if models.length === 0}
        <option value="" disabled selected>Loading models...</option>
      {/if}
      {#each models as model}
        <option value={model.id}>{model.name}</option>
      {/each}
      <option value="custom">Custom ID (HuggingFace)...</option>
    </select>

    {#if modelSelect === 'custom'}
      <input type="text" placeholder="e.g. onnx-community/whisper-tiny" class="custom-input" bind:value={customModelId}>
    {/if}

    <label for="quantization" class="mt-2">Quantization (Weights)</label>
    <select id="quantization" bind:value={quantization}>
      <option value="q4">Q4 (WebGPU Optimized - Default)</option>
      <option value="int8">Int8 (Standard ONNX)</option>
      <option value="fp32">FP32 (High Precision - Large)</option>
    </select>

    <label for="language">Language</label>
    <select id="language" bind:value={language}>
      <option value="en">English</option>
      <option value="zh">Chinese (中文)</option>
      <option value="ja">Japanese (日本語)</option>
      <option value="es">Spanish</option>
      <option value="fr">French</option>
      <option value="de">German</option>
      <option value="ko">Korean</option>
      <option value="auto">Auto Detect</option>
    </select>

    <label for="historyLines">History Lines (0-5)</label>
    <input type="number" id="historyLines" min="0" max="5" bind:value={historyLines}>

    <label for="fontSize">Subtitle Size</label>
    <input type="range" id="fontSize" min="16" max="48" bind:value={fontSize}>
    <div class="note">Preview: <span class="preview-badge" style="font-size: {fontSize}px">Abc</span></div>
  </div>

  <div class="debug-section">
    <details>
      <summary>Debug Tools</summary>
      <div class="debug-content">
        <button class="btn-clear" on:click={clearCache}>Clear All Downloaded Models</button>
        <button class="btn-list" on:click={listModels}>Show Installed Models</button>
        
        {#if showInstalledModels}
          <div class="models-list">
             <strong>Result:</strong><br>
             {#each installedModels as m}
               {m}<br>
             {/each}
          </div>
        {/if}

        <p class="note mt-1">This will free up disk space. You will need to re-download models next time.</p>
      </div>
    </details>
  </div>
</main>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    padding: 16px;
    width: 320px;
    margin: 0;
  }

  h1 {
    font-size: 1.25em;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-main {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 1.1em;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-start { background: #3b82f6; color: white; }
  .btn-start:hover { background: #2563eb; }

  .btn-stop { background: #ef4444; color: white; }
  .btn-stop:hover { background: #dc2626; }

  .status-badge {
    font-size: 0.8em;
    padding: 4px 8px;
    background: #eee;
    border-radius: 12px;
    font-weight: normal;
  }

  .status-recording { background: #fecaca; color: #dc2626; }

  .settings {
    margin-top: 24px;
    border-top: 1px solid #eee;
    padding-top: 16px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.9em;
    font-weight: 500;
    color: #374151;
  }

  select, input[type="range"], input[type="number"], input[type="text"] {
    width: 100%;
    padding: 6px;
    border-radius: 4px;
    border: 1px solid #ccc;
    margin-bottom: 12px;
    box-sizing: border-box;
  }
  
  .custom-input {
    margin-top: -6px; /* Pull closer to dropdown */
  }

  .note {
    font-size: 0.8em;
    color: #6b7280;
    margin-top: -8px;
    margin-bottom: 12px;
  }

  .preview-badge {
    background: #000;
    color: #fff;
    padding: 2px 4px;
    border-radius: 4px;
  }

  /* Active Tab Info */
  .active-tab-info {
    margin-bottom: 12px;
    font-size: 0.9em;
    padding: 8px;
    background: #f3f4f6;
    border-radius: 6px;
  }

  .active-tab-info .btn-link {
    background: none;
    border: none;
    padding: 0;
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }
  .active-tab-info .btn-link:hover {
    text-decoration: underline;
  }

  /* Progress Bar */
  .progress-container { margin-bottom: 16px; }
  .progress-header { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 4px; color: #555; }
  .progress-bar-bg { background: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden; }
  .progress-bar-fill { height: 100%; transition: width 0.2s; }

  /* Debug Section */
  .debug-section { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
  details summary { font-size: 0.85em; color: #777; cursor: pointer; }
  .debug-content { margin-top: 8px; }
  
  .btn-clear { width: 100%; padding: 8px; background: #fca5a5; color: #7f1d1d; border: none; border-radius: 4px; font-size: 0.9em; cursor: pointer; }
  .btn-list { width: 100%; margin-top: 8px; padding: 8px; background: #e5e7eb; color: #374151; border: none; border-radius: 4px; font-size: 0.9em; cursor: pointer; }

  .models-list { margin-top: 8px; font-size: 0.8em; color: #555; word-break: break-all; }
  .mt-1 { margin-top: 4px; }
  .mt-2 { margin-top: 10px; }
</style>
