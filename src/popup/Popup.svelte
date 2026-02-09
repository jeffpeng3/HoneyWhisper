<script>
  import { onMount, onDestroy } from "svelte";
  import { DEFAULT_PROFILES } from "../lib/ModelRegistry.js";
  import { ModeWatcher } from "mode-watcher";

  // Shadcn Components
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import { Settings } from "lucide-svelte"; // Icon

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

  function onProfileChange(value) {
    selectedProfileId = value;
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

        chrome.runtime.sendMessage({
          type: "REQUEST_START",
          tabId: tab.id,
          profile: profile, // Pass full profile
        });

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
      <Select.Root
        selected={{ value: selectedProfileId, label: selectedProfileName }}
        onSelectedChange={(v) => onProfileChange(v.value)}
        disabled={isLoading}
      >
        <Select.Trigger class="w-full">
          <span class="truncate block w-full text-left"
            >{selectedProfileName || "Select Profile"}</span
          >
        </Select.Trigger>
        <Select.Content class="max-h-[180px]">
          {#each profiles as profile}
            <Select.Item value={profile.id} label={profile.name}
              >{profile.name}</Select.Item
            >
          {/each}
        </Select.Content>
      </Select.Root>
    {/if}

    <Button
      variant={isRecording ? "destructive" : "default"}
      class="w-full h-12 text-lg font-semibold"
      onclick={toggleRecording}
      disabled={isLoading}
    >
      {isLoading
        ? "Starting..."
        : isRecording
          ? "Stop Captioning"
          : "Start Captioning"}
    </Button>

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
