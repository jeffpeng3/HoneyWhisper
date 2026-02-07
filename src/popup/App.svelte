<script>
  import { onMount, onDestroy } from "svelte";

  // State
  let isRecording = false;
  let autoCloseOnReady = false;

  // Active Tab Info
  let showActiveTabInfo = false;
  let activeTabTitle = "Tab Name";
  let activeTabId = null;

  // Progress Bar
  let showProgress = false;
  let progressPercent = 0;
  let progressText = "Loading Model...";
  let progressStatus = "initiate"; // initiate, progress, done, error
  let progressError = "";

  onMount(async () => {
    // 1. Check recording state
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (response && response.isRecording) {
        setRecordingState(true, response.currentTabId);
      }
    } catch (e) {
      // Background might not be ready
    }

    // 2. Message Listeners
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
        progressError = message.data.error;
      }
    } else if (message.type === "RECORDING_STARTED") {
      progressText = "Recording Active!";
      // If we started from this popup, auto-close might be desired,
      // but usually users want to see it started.
      if (autoCloseOnReady) {
        setTimeout(() => {
          window.close();
        }, 800);
      }
    }
  }

  async function toggleRecording() {
    console.log("Toggle Recording clicked. Current state:", isRecording);
    if (!isRecording) {
      // Start
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];

      if (tab) {
        console.log("Found active tab:", tab.id);
        chrome.runtime.sendMessage({ type: "REQUEST_START", tabId: tab.id });
        setRecordingState(true);
        autoCloseOnReady = true;
      } else {
        console.error("No active tab found!");
        progressText = "Error: No active tab found.";
        showProgress = true;
      }
    } else {
      // Stop
      console.log("Sending REQUEST_STOP to background...");
      chrome.runtime.sendMessage({ type: "REQUEST_STOP" });
      setRecordingState(false);
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
      window.open(chrome.runtime.getURL("src/options/index.html"));
    }
  }
</script>

<main>
  <h1>
    HoneyWhisper
    <span class="status-badge {isRecording ? 'status-recording' : ''}">
      {isRecording ? "Recording" : "Ready"}
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

  <button
    class="btn-main {isRecording ? 'btn-stop' : 'btn-start'}"
    on:click={toggleRecording}
  >
    <span>{isRecording ? "Stop Captioning" : "Start Captioning"}</span>
  </button>

  <div class="footer-links">
    <button class="btn-link-small" on:click={openOptions}>⚙️ Settings</button>
  </div>
</main>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    padding: 16px;
    width: 280px; /* Slightly narrower since we have less content */
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
    margin-bottom: 12px;
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

  .footer-links {
    display: flex;
    justify-content: center;
    margin-top: 8px;
  }
  .btn-link-small {
    background: none;
    border: none;
    color: #6b7280;
    font-size: 0.9em;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .btn-link-small:hover {
    color: #374151;
    text-decoration: underline;
  }
</style>
