<script>
  import { onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { sendMessage } from "$lib/messaging";
  import { getSettings, extensionStorage } from "$lib/settings";
  import { getLocalSettings, localStorage } from "$lib/local-settings";

  import SettingsTab from "./SettingsTab.svelte";
  import AsrTab from "$lib/components/settings/AsrTab.svelte";
  import TranslationTab from "$lib/components/settings/TranslationTab.svelte";

  import { ModeWatcher } from "mode-watcher";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { checkUpdate } from "$lib/version.js";
  import { i18n } from "#i18n";

  let activeTab = "general";

  let historyLines = 1;
  let fontSize = 24;
  let translationService = "none";
  let targetLanguage = "zh-TW";
  let showOriginal = true;

  let asrBackend = "nemotron";
  let nemotronLanguage = "ja";
  let nemotronProfile = "NORMAL";
  let beamWidth = 1;
  let vadEnabled = false;
  let vadThreshold = 0.01;
  let vadMinSpeech = 0.25;
  let vadMinSilence = 0.4;
  let vadHold = 0.15;
  let geminiLanguage = "auto";
  let geminiApiKey = "";

  let installedModels = [];
  let statusMessage = "";

  let updateStatus = "idle";
  let updateData = null;

  onMount(async () => {
    await loadSettings();
    await handleCheckUpdate();
  });

  async function loadSettings() {
    const items = await getSettings();
    asrBackend = items.asrBackend || "nemotron";
    nemotronLanguage = items.nemotronLanguage;
    nemotronProfile = items.nemotronProfile || "NORMAL";
    beamWidth = items.beamWidth || 1;
    vadEnabled = items.vadEnabled ?? false;
    vadThreshold = items.vadThreshold ?? 0.01;
    vadMinSpeech = items.vadMinSpeech ?? 0.25;
    vadMinSilence = items.vadMinSilence ?? 0.4;
    vadHold = items.vadHold ?? 0.15;
    geminiLanguage = items.geminiLanguage || "auto";
    fontSize = parseInt(items.fontSize);
    historyLines = parseInt(items.historyLines);
    translationService = items.translationService || "none";
    targetLanguage = items.targetLanguage;
    showOriginal = items.showOriginal !== undefined ? items.showOriginal : true;
    const localItems = await getLocalSettings();
    geminiApiKey = localItems.geminiApiKey;
  }

  async function saveSettings() {
    await Promise.all([
      extensionStorage.setItem("asrBackend", asrBackend),
      extensionStorage.setItem("nemotronLanguage", nemotronLanguage),
      extensionStorage.setItem("nemotronProfile", nemotronProfile),
      extensionStorage.setItem("beamWidth", beamWidth),
      extensionStorage.setItem("vadEnabled", vadEnabled),
      extensionStorage.setItem("vadThreshold", vadThreshold),
      extensionStorage.setItem("vadMinSpeech", vadMinSpeech),
      extensionStorage.setItem("vadMinSilence", vadMinSilence),
      extensionStorage.setItem("vadHold", vadHold),
      extensionStorage.setItem("geminiLanguage", geminiLanguage),
      extensionStorage.setItem("fontSize", String(fontSize)),
      extensionStorage.setItem("historyLines", historyLines),
      extensionStorage.setItem("translationService", translationService),
      extensionStorage.setItem("targetLanguage", targetLanguage),
      extensionStorage.setItem("showOriginal", showOriginal),
      localStorage.setItem("geminiApiKey", geminiApiKey),
    ]);

    showStatus(i18n.t("messages.settingsSaved"));

    sendMessage("UPDATE_SETTINGS", {
      settings: {
        translationService,
        targetLanguage,
        showOriginal,
        asrBackend,
        nemotronLanguage,
        nemotronProfile,
        beamWidth,
        vadEnabled,
        vadThreshold,
        vadMinSpeech,
        vadMinSilence,
        vadHold,
        geminiLanguage,
        geminiApiKey,
      },
    }).catch(() => {});

    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        sendMessage(
          "UPDATE_SETTINGS",
          { settings: { fontSize: String(fontSize), historyLines } },
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

  async function clearCache() {
    if (confirm(i18n.t("messages.clearCacheConfirm"))) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
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
      const keys = await caches.keys();
      installedModels = keys.length > 0 ? keys : [i18n.t("messages.noModelsCached")];
    } catch (err) {
      installedModels = ["Error: " + err.message];
    }
  }

  async function resetAllData() {
    if (confirm(i18n.t("messages.resetConfirm"))) {
      try {
        await browser.storage.sync.clear();
        await browser.storage.local.clear();
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        showStatus(i18n.t("messages.resetSuccess"));
        await loadSettings();
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
      } else if (result.hasUpdate) {
        updateStatus = "available";
        updateData = result;
      } else {
        updateStatus = "uptodate";
        updateData = result;
      }
    } catch (error) {
      updateStatus = "error";
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

  <div class="flex gap-1 mb-6 border-b">
    <button
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
      class:border-primary={activeTab === "general"}
      class:border-transparent={activeTab !== "general"}
      class:text-foreground={activeTab === "general"}
      class:text-muted-foreground={activeTab !== "general"}
      onclick={() => (activeTab = "general")}
    >
      {i18n.t("options.generalTab")}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
      class:border-primary={activeTab === "translation"}
      class:border-transparent={activeTab !== "translation"}
      class:text-foreground={activeTab === "translation"}
      class:text-muted-foreground={activeTab !== "translation"}
      onclick={() => (activeTab = "translation")}
    >
      {i18n.t("options.translationTab")}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
      class:border-primary={activeTab === "asr"}
      class:border-transparent={activeTab !== "asr"}
      class:text-foreground={activeTab === "asr"}
      class:text-muted-foreground={activeTab !== "asr"}
      onclick={() => (activeTab = "asr")}
    >
      {i18n.t("options.asrTab")}
    </button>
  </div>

  {#if activeTab === "general"}
    <SettingsTab
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
  {:else if activeTab === "translation"}
    <TranslationTab
      bind:service={translationService}
      bind:targetLanguage
      bind:showOriginal
      bind:asrBackend
      onSave={saveSettings}
    />
  {:else}
    <AsrTab
      bind:asrBackend
      bind:nemotronLanguage
      bind:nemotronProfile
      bind:beamWidth
      bind:vadEnabled
      bind:vadThreshold
      bind:vadMinSpeech
      bind:vadMinSilence
      bind:vadHold
      bind:geminiLanguage
      bind:geminiApiKey
      onSave={saveSettings}
    />
  {/if}
</main>
