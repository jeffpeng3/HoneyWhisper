<script>
  import { onMount } from "svelte";
  import { ModelRegistry, DEFAULT_PROFILES } from "$lib/ModelRegistry.js";
  import { browser } from "wxt/browser";
  import { sendMessage } from "$lib/messaging";
  import { getSettings, extensionStorage } from "$lib/settings";

  import ProfileTab from "./ProfileTab.svelte";
  import HubTab from "./HubTab.svelte";
  import SettingsTab from "./SettingsTab.svelte";
  import AdvancedSettings from "./AdvancedSettings.svelte";

  import { ModeWatcher } from "mode-watcher";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { checkUpdate } from "$lib/version.js";
  import { i18n } from "#i18n";

  // Shadcn UI Components
  import * as Tabs from "$lib/components/ui/tabs/index.js";

  // Tabs
  let activeTab = "settings"; // profiles, hub, settings

  // Profiles State
  let profiles = [];
  let editingProfileId = null;
  let tempProfile = {};

  // Hub State
  let hubModels = [];
  let hubLoading = false;

  // Settings State
  let language = "ja";
  let historyLines = 1;
  let fontSize = 24;
  let translationEnabled = false;
  let translationService = "google";
  let targetLanguage = "zh-TW";
  let showOriginal = true;

  // Debug
  let installedModels = [];
  let statusMessage = "";

  // Update Check State
  let updateStatus = "idle";
  let updateData = null;

  // Advanced VAD Settings
  let vadSettings = {
    positiveSpeechThreshold: 0.8,
    negativeSpeechThreshold: 0.45,
    minSpeechMs: 100,
    redemptionMs: 50,
  };

  onMount(async () => {
    loadSettings();
    loadHubModels();
    handleCheckUpdate();
  });

  async function loadSettings() {
    const items = await getSettings();
    profiles = items.profiles || DEFAULT_PROFILES;
    language = items.language;
    fontSize = parseInt(items.fontSize);
    historyLines = parseInt(items.historyLines);
    translationEnabled = items.translationEnabled;
    translationService = items.translationService || "google";
    targetLanguage = items.targetLanguage;
    showOriginal = items.showOriginal !== undefined ? items.showOriginal : true;

    // Merge defaults just in case
    vadSettings = { ...vadSettings, ...(items.vad || {}) };
  }

  async function loadHubModels() {
    hubLoading = true;
    try {
      const { models, error } = await ModelRegistry.fetchModels();
      hubModels = models;
      if (error) {
        showStatus(i18n.t("hub.loadFailed"));
        console.warn("Hub Load Error:", error);
      }
    } catch (e) {
      console.error("Error loading hub:", e);
      hubModels = [];
    } finally {
      hubLoading = false;
    }
  }

  async function saveSettings() {
    await Promise.all([
      extensionStorage.setItem("profiles", profiles),
      extensionStorage.setItem("language", language),
      extensionStorage.setItem("fontSize", String(fontSize)),
      extensionStorage.setItem("historyLines", historyLines),
      extensionStorage.setItem("translationEnabled", translationEnabled),
      extensionStorage.setItem("translationService", translationService),
      extensionStorage.setItem("targetLanguage", targetLanguage),
      extensionStorage.setItem("showOriginal", showOriginal),
      extensionStorage.setItem("vad", vadSettings),
    ]);

    showStatus(i18n.t("messages.settingsSaved"));
    // Notify offscreen
    sendMessage("UPDATE_SETTINGS", {
      settings: {
        translationEnabled,
        translationService,
        targetLanguage,
        language,
        showOriginal,
        vad: vadSettings,
      },
    }).catch(() => {});

    // Notify content scripts in all tabs
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        sendMessage(
          "UPDATE_SETTINGS",
          {
            settings: { fontSize: String(fontSize), historyLines },
          },
          tab.id,
        ).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to broadcast settings to tabs", e);
    }
  }

  function showStatus(msg) {
    statusMessage = msg;
    setTimeout(() => (statusMessage = ""), 3000);
  }

  function createProfileFromModel(model) {
    const newProfile = ModelRegistry.createProfile(
      model.name,
      model.id,
      model.type,
      { quantization: "q4" },
    );
    profiles = [...profiles, newProfile];
    saveSettings();

    // Jump to profile tab and open edit view
    activeTab = "profiles";
    editingProfileId = newProfile.id;
    tempProfile = { ...newProfile };

    showStatus(`${i18n.t("messages.profileCreated")} ${newProfile.name}`);
  }

  // --- Debug ---
  async function clearCache() {
    if (confirm(i18n.t("messages.clearCacheConfirm"))) {
      try {
        await sendMessage("CLEAR_CACHE", undefined);
        showStatus(i18n.t("messages.clearedCache"));
        installedModels = [];
      } catch (err) {
        alert(i18n.t("messages.clearCacheError") + err.message);
      }
    }
  }

  async function listModels() {
    installedModels = [];
    try {
      const models = await sendMessage("GET_CACHED_MODELS", undefined);
      installedModels =
        models && models.length > 0
          ? models
          : [i18n.t("messages.noModelsCached")];
    } catch (err) {
      installedModels = ["Error: " + err.message];
    }
  }

  async function resetAllData() {
    if (confirm(i18n.t("messages.resetConfirm"))) {
      try {
        await browser.storage.sync.clear();
        await browser.storage.local.clear();

        await sendMessage("CLEAR_CACHE", undefined);

        showStatus(i18n.t("messages.resetSuccess"));

        // Reload default settings
        loadSettings();
        installedModels = [];
      } catch (err) {
        alert(i18n.t("messages.resetError") + err.message);
      }
    }
  }

  async function handleCheckUpdate() {
    updateStatus = "checking";
    try {
      const result = await checkUpdate();
      if (result.error) {
        updateStatus = "error";
        statusMessage = i18n.t("update.failed");
      } else if (result.hasUpdate) {
        updateStatus = "available";
        updateData = result;
      } else {
        updateStatus = "uptodate";
        statusMessage = i18n.t("update.upToDate");
        updateData = result;
      }
    } catch (error) {
      updateStatus = "error";
      statusMessage = i18n.t("update.failed");
    }
  }
</script>

<ModeWatcher />

<main class="container mx-auto p-4 max-w-4xl">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">{i18n.t("name")}</h1>
    <div class="flex items-center gap-4">
      {#if statusMessage}
        <span class="text-green-600 font-medium">{statusMessage}</span>
      {/if}
      <ThemeToggle />
    </div>
  </div>

  <Tabs.Root
    value={activeTab}
    onValueChange={(v) => (activeTab = v)}
    class="w-full"
  >
    <Tabs.List class="grid w-full grid-cols-4 mb-6">
      <Tabs.Trigger value="profiles"
        >{i18n.t("options.profilesTab")}</Tabs.Trigger
      >
      <Tabs.Trigger value="hub">{i18n.t("options.hubTab")}</Tabs.Trigger>
      <Tabs.Trigger value="settings">{i18n.t("options.title")}</Tabs.Trigger>
      <Tabs.Trigger value="advanced"
        >{i18n.t("options.advancedTab")}</Tabs.Trigger
      >
    </Tabs.List>

    <Tabs.Content value="profiles">
      <ProfileTab
        bind:profiles
        bind:editingProfileId
        bind:tempProfile
        onSave={saveSettings}
      />
    </Tabs.Content>

    <Tabs.Content value="hub">
      <HubTab
        {hubModels}
        {hubLoading}
        onCreateProfile={createProfileFromModel}
      />
    </Tabs.Content>

    <Tabs.Content value="settings">
      <SettingsTab
        bind:translationEnabled
        bind:showOriginal
        bind:translationService
        bind:targetLanguage
        bind:language
        bind:fontSize
        bind:historyLines
        {installedModels}
        {updateStatus}
        {updateData}
        onSave={saveSettings}
        onCheckUpdate={handleCheckUpdate}
        onClearCache={clearCache}
        onListModels={listModels}
        onResetAll={resetAllData}
      />
    </Tabs.Content>

    <Tabs.Content value="advanced">
      <AdvancedSettings bind:vadSettings onChange={saveSettings} />
    </Tabs.Content>
  </Tabs.Root>
</main>
