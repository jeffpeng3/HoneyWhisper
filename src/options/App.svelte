<script>
  import { onMount } from 'svelte';

  // Settings State
  let models = [];
  let modelSelect = '';
  let customModelId = '';
  let quantization = 'q4';
  let language = 'en';
  let historyLines = 1;
  let fontSize = 24;

  // Debug State
  let installedModels = [];
  let showInstalledModels = false;
  let statusMessage = '';

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
  });

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
    }, () => {
        // Show saved status briefly? Could add if needed.
    });

    // Notify active tabs
    chrome.runtime.sendMessage({
      target: 'content',
      type: 'UPDATE_SETTINGS',
      settings: { fontSize: String(fontSize), historyLines }
    }).catch(() => {});

    // Notify offscreen
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'UPDATE_SETTINGS',
      settings: { language, model_id: finalModelId, quantization }
    }).catch(() => {});
  }

  async function clearCache() {
    if (confirm('Are you sure you want to delete all downloaded models?')) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            statusMessage = `Cleared ${keys.length} cache(s).`;
            installedModels = []; 
            setTimeout(() => statusMessage = '', 3000);
        } catch (err) {
            alert('Error clearing cache: ' + err.message);
        }
    }
  }

  async function listModels() {
    installedModels = []; 
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
  <div class="header">
    <h1>HoneyWhisper Settings</h1>
    {#if statusMessage}
        <span class="status-msg">{statusMessage}</span>
    {/if}
  </div>

  <div class="settings-group">
    <h2>Model Configuration</h2>
    <div class="setting-item">
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
    </div>

    <div class="setting-item">
        <label for="quantization">Quantization (Weights)</label>
        <select id="quantization" bind:value={quantization}>
        <option value="q4">Q4 (WebGPU Optimized - Default)</option>
        <option value="int8">Int8 (Standard ONNX)</option>
        <option value="fp32">FP32 (High Precision - Large)</option>
        </select>
    </div>
  </div>

  <div class="settings-group">
    <h2>Transcription Settings</h2>
    <div class="setting-item">
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
    </div>
  </div>

  <div class="settings-group">
    <h2>Display Settings</h2>
    <div class="setting-item">
        <label for="historyLines">History Lines (0-5)</label>
        <input type="number" id="historyLines" min="0" max="5" bind:value={historyLines}>
    </div>

    <div class="setting-item">
        <label for="fontSize">Subtitle Size</label>
        <div class="range-container">
            <input type="range" id="fontSize" min="16" max="48" bind:value={fontSize}>
            <span class="preview-badge" style="font-size: {fontSize}px">Abc</span>
        </div>
    </div>
  </div>

  <div class="debug-section">
    <div class="settings-group danger-zone">
        <h2>Storage & Debug</h2>
        <div class="actions">
            <button class="btn-clear" on:click={clearCache}>Clear All Downloaded Models</button>
            <button class="btn-list" on:click={listModels}>Show Installed Models</button>
        </div>
        
        {#if showInstalledModels}
            <div class="models-list">
                <strong>Result:</strong>
                <ul>
                {#each installedModels as m}
                    <li>{m}</li>
                {/each}
                </ul>
            </div>
        {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    background-color: #f9fafb;
    color: #1f2937;
  }

  h1 {
    font-size: 1.5em;
    margin-bottom: 20px;
    color: #111827;
  }

  h2 {
    font-size: 1.1em;
    margin-bottom: 12px;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
  }

  .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
  }

  .status-msg {
      color: #059669;
      font-weight: 500;
  }

  .settings-group {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 24px;
  }

  .setting-item {
      margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.95em;
    font-weight: 500;
    color: #4b5563;
  }

  select, input[type="number"], input[type="text"] {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    font-size: 1em;
    box-sizing: border-box;
  }

  input[type="range"] {
      width: 200px;
  }

  .range-container {
      display: flex;
      align-items: center;
      gap: 16px;
  }
  
  .custom-input {
    margin-top: 8px;
  }

  .preview-badge {
    background: #000;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1;
  }

  .danger-zone h2 {
      color: #b91c1c;
      border-color: #fecaca;
  }

  .actions {
      display: flex;
      gap: 12px;
  }
  
  .btn-clear { padding: 10px 16px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; font-weight: 500; cursor: pointer; }
  .btn-clear:hover { background: #fecaca; }

  .btn-list { padding: 10px 16px; background: #e5e7eb; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 500; cursor: pointer; }
  .btn-list:hover { background: #d1d5db; }

  .models-list { margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 6px; font-family: monospace; }
  .models-list ul { margin: 0; padding-left: 20px; }
</style>
