<script>
  import { onMount, onDestroy } from "svelte";
  import { DEFAULT_PROFILES } from "../lib/ModelRegistry.js";

  // State
  let isRecording = false;
  let isLoading = false;
  let autoCloseOnReady = false;

  // Active Tab Info
  let showActiveTabInfo = false;
  let activeTabTitle = "Tab Name";
  let activeTabId = null;
  let pendingTabId = null;

  // Progress Bar
  let showProgress = false;
  let progressPercent = 0;
  let progressText = "Loading Model...";
  let progressStatus = "initiate"; // initiate, progress, done, error

  // Profiles
  let profiles = [];
  let selectedProfileId = "";

  onMount(async () => {
    // 1. Load Profiles & Settings
    chrome.storage.sync.get(
      {
        profiles: DEFAULT_PROFILES,
        activeProfileId: DEFAULT_PROFILES[0].id,
      },
      (items) => {
        profiles = items.profiles || DEFAULT_PROFILES;
        // Ensure default exists in list
        if (!profiles.find((p) => p.id === items.activeProfileId)) {
          selectedProfileId = profiles[0] ? profiles[0].id : "";
        } else {
          selectedProfileId = items.activeProfileId;
        }
      },
    );

    // 2. Check recording state
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (response && response.isRecording) {
        setRecordingState(true, response.currentTabId);
      }
    } catch (e) {
      // Background might not be ready
    }

    // 3. Message Listeners
    chrome.runtime.onMessage.addListener(handleMessage);
  });

  onDestroy(() => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  });

  function handleMessage(message) {
    if (message.type === "MODEL_LOADING") {
      showProgress = true;
      progressStatus = message.data.status;

      if (message.data.status === "progress") {
        progressPercent = Math.round(message.data.progress || 0);
        progressText = `Loading ${message.data.file || "Model"}...`;
      } else if (message.data.status === "done") {
        progressPercent = 100;
        progressText = "Whisper Model Ready!";
        if (!autoCloseOnReady) {
          setTimeout(() => {
            showProgress = false;
          }, 2000);
        }
      } else if (message.data.status === "initiate") {
        progressPercent = 0;
        progressText = "Initializing...";
      } else if (message.data.status === "error") {
        progressText = "Error: " + message.data.error;
        isLoading = false; // Reset loading on error
      }
    } else if (message.type === "RECORDING_STARTED") {
      isLoading = false;
      progressText = "Recording Active!";
      // Confirm recording state with pending tab ID if available
      setRecordingState(true, pendingTabId);

      if (autoCloseOnReady) {
        setTimeout(() => {
          window.close();
        }, 800);
      }
    }
  }

  function onProfileChange() {
    // Save selection
    chrome.storage.sync.set({ activeProfileId: selectedProfileId });
  }

  async function toggleRecording() {
    console.log("Toggle Recording clicked. Current state:", isRecording);
    if (!isRecording) {
      // Find Selected Profile
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (!profile) {
        alert("Please select a valid profile.");
        return;
      }

      // Start
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];

      if (tab) {
        console.log("Found active tab:", tab.id);

        isLoading = true; // Set loading state
        pendingTabId = tab.id; // Store tab ID for later

        // We pass the profile configuration directly in the start request
        // This overrides whatever the background might load from default storage
        // Actually, background loads from storage too.
        // Best practice: Save as 'active settings' in storage before starting?
        // OR pass it in the message. Let's pass in message.

        chrome.runtime.sendMessage({
          type: "REQUEST_START",
          tabId: tab.id,
          profile: profile, // Pass full profile
        });

        // Don't set recording state immediately
        // setRecordingState(true);
        autoCloseOnReady = true;
      } else {
        console.error("No active tab found!");
        progressText = "Error: No active tab found.";
        showProgress = true;
      }
    } else {
      // Stop
      chrome.runtime.sendMessage({ type: "REQUEST_STOP" });
      setRecordingState(false);
      isLoading = false;
    }
  }

  async function setRecordingState(recording, tabId = null) {
    isRecording = recording;

    if (recording && tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        activeTabTitle =
          tab.title.length > 25
            ? tab.title.substring(0, 25) + "..."
            : tab.title;
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

  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  }
</script>

<main>
  <h1>
    HoneyWhisper
    <span class="status-badge {isRecording ? 'status-recording' : ''}">
      {isLoading ? "Initializing..." : isRecording ? "Recording" : "Ready"}
    </span>
  </h1>

  {#if showActiveTabInfo}
    <div class="active-tab-info">
      Capturing: <button class="btn-link" on:click={activateTab}
        >{activeTabTitle}</button
      >
    </div>
  {/if}

  {#if showProgress}
    <div class="progress-container">
      <div class="progress-header">
        <span>{progressText}</span>
        <span>{progressPercent}%</span>
      </div>
      <div class="progress-bar-bg">
        <div
          class="progress-bar-fill"
          style="width: {progressPercent}%; background: {progressStatus ===
          'error'
            ? '#ef4444'
            : '#3b82f6'}"
        ></div>
      </div>
    </div>
  {/if}

  <div class="control-group">
    {#if !isRecording}
      <label for="profileSelect">Profile</label>
      <div class="select-row">
        <select
          id="profileSelect"
          bind:value={selectedProfileId}
          on:change={onProfileChange}
          disabled={isLoading}
        >
          {#each profiles as profile}
            <option value={profile.id}>{profile.name}</option>
          {/each}
        </select>
        <button
          class="btn-icon"
          title="Manage Profiles"
          on:click={openOptions}
          disabled={isLoading}>⚙️</button
        >
      </div>
    {/if}
  </div>

  <button
    class="btn-main {isRecording ? 'btn-stop' : 'btn-start'}"
    on:click={toggleRecording}
    disabled={isLoading}
  >
    <span
      >{isLoading
        ? "Starting..."
        : isRecording
          ? "Stop Captioning"
          : "Start Captioning"}</span
    >
  </button>
</main>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    padding: 16px;
    width: 280px;
    margin: 0;
  }

  h1 {
    font-size: 1.25em;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .control-group {
    margin-bottom: 12px;
  }

  label {
    font-size: 0.85em;
    color: #6b7280;
    margin-bottom: 4px;
    display: block;
  }

  .select-row {
    display: flex;
    gap: 8px;
  }

  select {
    flex: 1;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
  }

  .btn-icon {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    padding: 0 8px;
  }
  .btn-icon:hover {
    background: #f3f4f6;
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
    margin-top: 12px;
  }

  .btn-start {
    background: #3b82f6;
    color: white;
  }
  .btn-start:hover {
    background: #2563eb;
  }

  .btn-stop {
    background: #ef4444;
    color: white;
  }
  .btn-stop:hover {
    background: #dc2626;
  }

  .status-badge {
    font-size: 0.8em;
    padding: 4px 8px;
    background: #eee;
    border-radius: 12px;
    font-weight: normal;
  }
  .status-recording {
    background: #fecaca;
    color: #dc2626;
  }

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
  }
  .active-tab-info .btn-link:hover {
    text-decoration: underline;
  }

  .progress-container {
    margin-bottom: 16px;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    margin-bottom: 4px;
    color: #555;
  }
  .progress-bar-bg {
    background: #e5e7eb;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    transition: width 0.2s;
  }
</style>
