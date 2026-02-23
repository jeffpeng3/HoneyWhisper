<script>
  import { onMount, onDestroy } from "svelte";
  import { DEFAULT_PROFILES, ModelRegistry } from "$lib/ModelRegistry.js";
  import { browser } from "wxt/browser";
  import { ModeWatcher } from "mode-watcher";
  import { sendMessage, onMessage } from "$lib/messaging";
  import { getSettings, extensionStorage } from "$lib/settings";

  // Shadcn Components
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import { Settings } from "lucide-svelte"; // Icon

  // State
  let isRecording = false;
  let isLoading = false;
  let isDownloading = false;
  let autoCloseOnReady = false;
  let modelCached = null; // null=checking, true=cached, false=not cached

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

  let cleanupListeners = [];

  onMount(async () => {
    // 1. Load Profiles & Settings
    const settings = await getSettings();
    profiles = settings.profiles || DEFAULT_PROFILES;
    // Ensure default exists in list
    if (!profiles.find((p) => p.id === settings.activeProfileId)) {
      selectedProfileId = profiles[0] ? profiles[0].id : "";
    } else {
      selectedProfileId = settings.activeProfileId;
    }
    // Check if current profile's model is cached
    checkModelStatus();

    // 2. Check recording state
    try {
      const response = await sendMessage("GET_STATE", undefined);
      if (response && response.isRecording) {
        setRecordingState(true, response.currentTabId); // Ensure currentTabId is handled correctly by GET_STATE
      }
    } catch (e) {
      // Background might not be ready
    }

    // 3. Message Listeners
    cleanupListeners.push(
      onMessage("DOWNLOAD_PROGRESS", (message) => {
        showProgress = true;
        progressStatus = message.data.status;

        if (message.data.status === "error") {
          progressText = "Error: " + (message.data.error || "Unknown Error");
          isLoading = false;
          isDownloading = false;
          return;
        }

        if (message.data.status === "done") {
          progressPercent = 100;
          progressText = "Finishing Download...";
          return;
        }

        progressPercent = Math.round(message.data.progress || 0);
        progressText = `Loading ${message.data.file || "Model"}...`;
      }),
    );

    cleanupListeners.push(
      onMessage("DOWNLOAD_COMPLETE", async () => {
        // Download finished — check cache to ensure it's there
        await checkModelStatus();
        isDownloading = false;
        if (modelCached) {
          progressText = "Download Complete!";
          progressPercent = 100;
        } else {
          progressText = "Download failed to cache.";
        }
        setTimeout(() => {
          showProgress = false;
        }, 2000);
      }),
    );

    cleanupListeners.push(
      onMessage("RECORDING_STARTED", () => {
        isLoading = false;
        progressText = "Recording Active!";
        setRecordingState(true, pendingTabId);

        if (autoCloseOnReady) {
          setTimeout(() => {
            window.close();
          }, 800);
        }
      }),
    );
  });

  onDestroy(() => {
    cleanupListeners.forEach((cleanup) => cleanup());
  });

  async function onProfileChange(value) {
    selectedProfileId = value;
    // Save selection
    await extensionStorage.setItem("activeProfileId", selectedProfileId);
    checkModelStatus();
  }

  async function checkModelStatus() {
    modelCached = null;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) {
      modelCached = true;
      return;
    }
    try {
      const explicitDevice =
        profile.backend === "remote"
          ? "remote"
          : profile.backend === "webgpu"
            ? "webgpu"
            : "wasm";
      const isCached = await sendMessage("CHECK_MODEL_CACHED", {
        model_id: profile.model_id,
        device: explicitDevice,
        quantization: profile.quantization,
      });
      modelCached = isCached;
    } catch (e) {
      modelCached = false;
    }
  }

  async function downloadModel() {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) {
      alert("Please select a valid profile.");
      return;
    }
    isDownloading = true;
    showProgress = true;
    progressPercent = 0;
    progressText = "Downloading Model...";

    // Pass index since background finds the profile by index
    const profileIndex = profiles.findIndex((p) => p.id === selectedProfileId);
    sendMessage("REQUEST_DOWNLOAD", {
      profileIndex: profileIndex >= 0 ? profileIndex : 0,
    }).catch(() => {});
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
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];

      if (tab) {
        console.log("Found active tab:", tab.id);

        isLoading = true; // Set loading state
        pendingTabId = tab.id; // Store tab ID for later

        const profileIndex = profiles.findIndex(
          (p) => p.id === selectedProfileId,
        );

        sendMessage("REQUEST_START", {
          profileIndex: profileIndex >= 0 ? profileIndex : 0,
        }).catch(() => {});

        autoCloseOnReady = true;
      } else {
        console.error("No active tab found!");
        progressText = "Error: No active tab found.";
        showProgress = true;
      }
    } else {
      // Stop
      sendMessage("REQUEST_STOP", undefined).catch(() => {});
      setRecordingState(false);
      isLoading = false;
    }
  }

  async function setRecordingState(recording, tabId = null) {
    isRecording = recording;

    if (recording && tabId) {
      try {
        const tab = await browser.tabs.get(tabId);
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
      const tab = await browser.tabs.get(activeTabId);
      if (tab) {
        browser.tabs.update(tab.id, { active: true });
        browser.windows.update(tab.windowId, { focused: true });
      }
    }
  }

  function openOptions() {
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL("options.html"));
    }
    window.close();
  }

  // Helper
  $: selectedProfileName =
    profiles.find((p) => p.id === selectedProfileId)?.name || "Select Profile";
</script>

<ModeWatcher />

<main class="w-[320px] min-h-[300px] p-4 bg-background text-foreground">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-lg font-bold">HoneyWhisper</h1>
    <Badge variant={isRecording ? "destructive" : "secondary"}>
      {isLoading ? "Initializing..." : isRecording ? "Recording" : "Ready"}
    </Badge>
  </div>

  {#if showActiveTabInfo}
    <div class="mb-4 p-2 bg-muted rounded text-sm flex items-center gap-2">
      <span class="text-muted-foreground">Capturing:</span>
      <button
        class="text-primary hover:underline font-medium truncate max-w-[180px]"
        onclick={activateTab}
      >
        {activeTabTitle}
      </button>
    </div>
  {/if}

  {#if showProgress}
    <div class="mb-4 space-y-2">
      <div class="flex justify-between text-xs text-muted-foreground">
        <span class={progressStatus === "error" ? "text-destructive" : ""}
          >{progressText}</span
        >
        <span>{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} class="h-2" />
    </div>
  {/if}

  <div class="space-y-4">
    {#if !isRecording}
      <Combobox
        value={selectedProfileId}
        options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        placeholder={selectedProfileName || "Select Profile"}
        onSelect={(v) => onProfileChange(v)}
        disabled={isLoading || isDownloading}
        class="w-full"
      />
    {/if}

    {#if isRecording}
      <Button
        variant="destructive"
        class="w-full h-12 text-lg font-semibold"
        onclick={toggleRecording}
      >
        Stop Captioning
      </Button>
    {:else if modelCached === null}
      <Button
        variant="default"
        class="w-full h-12 text-lg font-semibold"
        disabled={true}
      >
        Checking...
      </Button>
    {:else if modelCached === false}
      <Button
        variant="secondary"
        class="w-full h-12 text-lg font-semibold"
        onclick={downloadModel}
        disabled={isDownloading}
      >
        {isDownloading ? "Downloading..." : "Download Model"}
      </Button>
    {:else}
      <Button
        variant="default"
        class="w-full h-12 text-lg font-semibold"
        onclick={toggleRecording}
        disabled={isLoading}
      >
        {isLoading ? "Starting..." : "Start Captioning"}
      </Button>
    {/if}

    {#if !isRecording}
      <Button
        variant="ghost"
        class="w-full"
        onclick={openOptions}
        disabled={isLoading}
        title="Manage Profiles"
      >
        <Settings class="h-4 w-4 mr-2" />
        Settings
      </Button>
    {/if}
  </div>
</main>
