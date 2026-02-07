<script>
  import { onMount } from "svelte";
  import { ModelRegistry, DEFAULT_PROFILES } from "../lib/ModelRegistry.js";

  // Tabs
  let activeTab = "profiles"; // profiles, hub, settings

  // Profiles State
  let profiles = [];
  let editingProfileId = null;
  let tempProfile = {};

  // Hub State
  let hubModels = [];
  let hubLoading = false;

  // Settings State
  let language = "en";
  let historyLines = 1;
  let fontSize = 24;
  let translationEnabled = false;
  let targetLanguage = "zh-TW";

  // Debug
  let installedModels = [];
  let statusMessage = "";

  const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese (中文)" },
    { code: "ja", name: "Japanese (日本語)" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "ko", name: "Korean" },
    { code: "auto", name: "Auto Detect" },
  ];

  const TARGET_LANGUAGES = [
    { code: "zh-TW", name: "Traditional Chinese (繁體中文)" },
    { code: "zh-CN", name: "Simplified Chinese (简体中文)" },
    { code: "en", name: "English" },
    { code: "ja", name: "Japanese (日本語)" },
    { code: "ko", name: "Korean (한국어)" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
  ];

  onMount(async () => {
    loadSettings();
    loadHubModels();
  });

  function loadSettings() {
    chrome.storage.sync.get(
      {
        profiles: DEFAULT_PROFILES,
        activeProfileId: DEFAULT_PROFILES[0].id,
        language: "en",
        fontSize: "24",
        historyLines: 1,
        translationEnabled: false,
        targetLanguage: "zh-TW",
      },
      (items) => {
        profiles = items.profiles || DEFAULT_PROFILES;
        language = items.language;
        fontSize = parseInt(items.fontSize);
        historyLines = parseInt(items.historyLines);
        translationEnabled = items.translationEnabled;
        targetLanguage = items.targetLanguage;
      },
    );
  }

  async function loadHubModels() {
    hubLoading = true;
    try {
      // First try fetching form generic ModelRegistry/Local
      hubModels = ModelRegistry.getModels();

      // Try fetching remote
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/jeffpeng3/HoneyWhisper/master/public/models.json",
        );
        if (res.ok) {
          const remoteModels = await res.json();
          // Merge? Or just replace?
          // For now simple replacement or concat if we want to keep local defaults
          // Let's just use what we get but ensure we have valid structure
          hubModels = remoteModels;
        }
      } catch (err) {
        console.warn("Failed to fetch from GitHub, using local defaults", err);
      }
    } catch (e) {
      console.error("Error loading hub:", e);
    } finally {
      hubLoading = false;
    }
  }

  function saveSettings() {
    chrome.storage.sync.set(
      {
        profiles,
        language,
        fontSize: String(fontSize),
        historyLines,
        translationEnabled,
        targetLanguage,
      },
      () => {
        showStatus("Settings Saved");
        // Notify others
        chrome.runtime
          .sendMessage({
            target: "content",
            type: "UPDATE_SETTINGS",
            settings: { fontSize: String(fontSize), historyLines },
          })
          .catch(() => {});
        chrome.runtime
          .sendMessage({
            target: "offscreen",
            type: "UPDATE_SETTINGS",
            settings: { translationEnabled, targetLanguage, language },
          })
          .catch(() => {});
      },
    );
  }

  function showStatus(msg) {
    statusMessage = msg;
    setTimeout(() => (statusMessage = ""), 3000);
  }

  // --- Profile Management ---

  function createProfile() {
    tempProfile = {
      id: crypto.randomUUID(),
      name: "New Profile",
      backend: "webgpu",
      model_id: "onnx-community/whisper-tiny",
      quantization: "q4",
      remote_endpoint: "",
      remote_key: "",
    };
    editingProfileId = tempProfile.id;
  }

  function editProfile(profile) {
    tempProfile = { ...profile };
    editingProfileId = profile.id;
  }

  function saveProfile() {
    const index = profiles.findIndex((p) => p.id === tempProfile.id);
    if (index !== -1) {
      profiles[index] = tempProfile;
    } else {
      profiles.push(tempProfile);
    }
    profiles = profiles; // Trigger update
    editingProfileId = null;
    saveSettings();
  }

  function deleteProfile(id) {
    if (confirm("Delete this profile?")) {
      profiles = profiles.filter((p) => p.id !== id);
      saveSettings();
    }
  }

  function cancelEdit() {
    editingProfileId = null;
  }

  function createProfileFromModel(model) {
    const newProfile = ModelRegistry.createProfile(
      model.name,
      model.id,
      "webgpu",
      { quantization: "q4" },
    );
    profiles = [...profiles, newProfile];
    saveSettings();
    activeTab = "profiles";
    showStatus(`Created profile: ${newProfile.name}`);
  }

  // --- Debug ---
  async function clearCache() {
    if (confirm("Are you sure you want to delete all downloaded models?")) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        showStatus(`Cleared ${keys.length} cache(s).`);
        installedModels = [];
      } catch (err) {
        alert("Error clearing cache: " + err.message);
      }
    }
  }

  async function listModels() {
    installedModels = [];
    try {
      if (await caches.has("transformers-cache")) {
        const cache = await caches.open("transformers-cache");
        const requests = await cache.keys();
        const modelsSet = new Set();
        requests.forEach((req) => {
          const match = req.url.match(/huggingface\.co\/([^/]+\/[^/]+)\//);
          if (match && match[1]) modelsSet.add(match[1]);
        });
        installedModels =
          modelsSet.size > 0 ? Array.from(modelsSet) : ["Cache empty."];
      } else {
        installedModels = ["No cache found."];
      }
    } catch (err) {
      installedModels = ["Error: " + err.message];
    }
  }
</script>

<main>
  <div class="header">
    <h1>HoneyWhisper</h1>
    {#if statusMessage}
      <span class="status-msg">{statusMessage}</span>
    {/if}
  </div>

  <div class="tabs">
    <button
      class="tab {activeTab === 'profiles' ? 'active' : ''}"
      on:click={() => (activeTab = "profiles")}>Profiles</button
    >
    <button
      class="tab {activeTab === 'hub' ? 'active' : ''}"
      on:click={() => (activeTab = "hub")}>Model Hub</button
    >
    <button
      class="tab {activeTab === 'settings' ? 'active' : ''}"
      on:click={() => (activeTab = "settings")}>Settings</button
    >
  </div>

  <div class="content">
    {#if activeTab === "profiles"}
      <div class="profiles-section">
        {#if !editingProfileId}
          <div class="list-header">
            <h2>My Profiles</h2>
            <button class="btn-primary" on:click={createProfile}
              >+ New Profile</button
            >
          </div>
          <div class="profile-grid">
            {#each profiles as profile}
              <div class="profile-card">
                <h3>{profile.name}</h3>
                <div class="profile-details">
                  <span class="badge {profile.backend}">{profile.backend}</span>
                  <span class="model-name">{profile.model_id}</span>
                </div>
                <div class="profile-actions">
                  <button on:click={() => editProfile(profile)}>Edit</button>
                  <button
                    class="btn-danger"
                    on:click={() => deleteProfile(profile.id)}>Delete</button
                  >
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="editor-section">
            <h2>
              {profiles.find((p) => p.id === tempProfile.id)
                ? "Edit Profile"
                : "New Profile"}
            </h2>

            <div class="form-group">
              <label>Profile Name</label>
              <input type="text" bind:value={tempProfile.name} />
            </div>

            <div class="form-group">
              <label>Backend</label>
              <div class="radio-group">
                <label
                  ><input
                    type="radio"
                    bind:group={tempProfile.backend}
                    value="webgpu"
                  /> Local (WebGPU)</label
                >
                <label
                  ><input
                    type="radio"
                    bind:group={tempProfile.backend}
                    value="remote"
                  /> Remote (API)</label
                >
              </div>
            </div>

            {#if tempProfile.backend === "webgpu"}
              <div class="form-group">
                <label>Model ID (HuggingFace)</label>
                <input
                  type="text"
                  bind:value={tempProfile.model_id}
                  list="common-models"
                />
                <datalist id="common-models">
                  <option value="onnx-community/whisper-tiny"> </option><option
                    value="onnx-community/whisper-base"
                  >
                  </option><option value="onnx-community/whisper-small">
                  </option></datalist
                >
              </div>
              <div class="form-group">
                <label>Quantization</label>
                <select bind:value={tempProfile.quantization}>
                  <option value="q4">Q4 (Default)</option>
                  <option value="int8">Int8</option>
                  <option value="fp32">FP32</option>
                </select>
              </div>
            {:else}
              <div class="form-group">
                <label>API Endpoint</label>
                <input
                  type="text"
                  bind:value={tempProfile.remote_endpoint}
                  placeholder="http://localhost:9000/v1/audio/transcriptions"
                />
              </div>
              <div class="form-group">
                <label>API Key (Optional)</label>
                <input type="password" bind:value={tempProfile.remote_key} />
              </div>
            {/if}

            <div class="editor-actions">
              <button class="btn-primary" on:click={saveProfile}
                >Save Profile</button
              >
              <button on:click={cancelEdit}>Cancel</button>
            </div>
          </div>
        {/if}
      </div>
    {:else if activeTab === "hub"}
      <div class="hub-section">
        <h2>Model Hub</h2>
        {#if hubLoading}
          <p>Loading models...</p>
        {:else}
          <div class="hub-grid">
            {#each hubModels as model}
              {#if model.type !== "remote"}
                <div class="hub-card">
                  <h3>{model.name}</h3>
                  <p>{model.id}</p>
                  <div class="hub-actions">
                    <a
                      href={model.homepage ||
                        `https://huggingface.co/${model.id}`}
                      target="_blank"
                      class="link-btn">View on HF</a
                    >
                    <button
                      class="btn-primary"
                      on:click={() => createProfileFromModel(model)}
                      >Create Profile</button
                    >
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === "settings"}
      <div class="settings-section">
        <div class="settings-group">
          <h2>Translation</h2>
          <div class="setting-item">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={translationEnabled}
                on:change={saveSettings}
              />
              Enable Real-time Translation
            </label>
          </div>
          {#if translationEnabled}
            <div class="setting-item">
              <label>Target Language</label>
              <select bind:value={targetLanguage} on:change={saveSettings}>
                {#each TARGET_LANGUAGES as lang}
                  <option value={lang.code}>{lang.name}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>

        <div class="settings-group">
          <h2>Recognition</h2>
          <div class="setting-item">
            <label>Source Language</label>
            <select bind:value={language} on:change={saveSettings}>
              {#each LANGUAGES as lang}
                <option value={lang.code}>{lang.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h2>Appearance</h2>
          <div class="setting-item">
            <label>Subtitle Size: {fontSize}px</label>
            <input
              type="range"
              min="16"
              max="48"
              bind:value={fontSize}
              on:change={saveSettings}
            />
          </div>
          <div class="setting-item">
            <label>History Lines: {historyLines}</label>
            <input
              type="number"
              min="0"
              max="5"
              bind:value={historyLines}
              on:change={saveSettings}
            />
          </div>
        </div>

        <div class="settings-group danger-zone">
          <h2>Debug</h2>
          <div class="actions">
            <button class="btn-clear" on:click={clearCache}>Clear Cache</button>
            <button on:click={listModels}>Check Cache</button>
          </div>
          {#if installedModels.length > 0}
            <div class="cache-list">
              <ul>
                {#each installedModels as m}<li>{m}</li>{/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  :global(body) {
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    padding: 0;
    margin: 0;
    background: #f9fafb;
    color: #1f2937;
  }

  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #111827;
  }
  .status-msg {
    color: #059669;
    font-weight: 500;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 10px;
    border-bottom: 2px solid #e5e7eb;
    margin-bottom: 20px;
  }
  .tab {
    padding: 10px 20px;
    background: none;
    border: none;
    font-size: 1rem;
    color: #6b7280;
    cursor: pointer;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }
  .tab.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }
  .tab:hover {
    color: #374151;
  }

  /* Layouts */
  .profile-grid,
  .hub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }

  .profile-card,
  .hub-card {
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
  }

  .profile-card h3,
  .hub-card h3 {
    margin: 0 0 8px 0;
    font-size: 1.1rem;
  }
  .profile-details {
    margin-bottom: 12px;
    font-size: 0.9rem;
    color: #4b5563;
  }
  .model-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: bold;
    margin-right: 6px;
  }
  .badge.webgpu {
    background: #dbeafe;
    color: #1e40af;
  }
  .badge.remote {
    background: #fee2e2;
    color: #991b1b;
  }

  .profile-actions,
  .hub-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  /* Forms */
  .editor-section,
  .settings-section {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .form-group,
  .setting-item {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #374151;
  }
  input[type="text"],
  input[type="password"],
  input[type="number"],
  select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .editor-actions {
    margin-top: 24px;
    display: flex;
    gap: 12px;
  }

  /* Buttons */
  button {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: white;
    cursor: pointer;
    font-weight: 500;
  }
  button:hover {
    background: #f3f4f6;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
    border: none;
  }
  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-danger {
    color: #dc2626;
    border-color: #fca5a5;
  }
  .btn-danger:hover {
    background: #fee2e2;
  }

  .link-btn {
    text-decoration: none;
    padding: 8px 16px;
    border-radius: 6px;
    color: #4b5563;
    border: 1px solid #d1d5db;
    font-size: 0.9rem;
    text-align: center;
  }
  .link-btn:hover {
    background: #f3f4f6;
  }

  /* Settings Groups */
  .settings-group {
    margin-bottom: 30px;
  }
  .settings-group h2 {
    font-size: 1.1rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }

  .danger-zone h2 {
    color: #dc2626;
    border-color: #fca5a5;
  }
  .btn-clear {
    background: #fee2e2;
    color: #991b1b;
    border: none;
  }
  .cache-list {
    margin-top: 10px;
    background: #f3f4f6;
    padding: 10px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.9rem;
  }
</style>
