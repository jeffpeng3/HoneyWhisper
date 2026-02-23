<script>
  import { onMount } from "svelte";
  import { ModelRegistry, DEFAULT_PROFILES } from "$lib/ModelRegistry.js";
  import { browser } from "wxt/browser";
  import { sendMessage } from "$lib/messaging";
  import { getSettings, extensionStorage } from "$lib/settings";
  import ModelHubCard from "./ModelHubCard.svelte";
  import AdvancedSettings from "./AdvancedSettings.svelte";
  import { ModeWatcher } from "mode-watcher";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { checkUpdate } from "$lib/version.js";
  import { i18n } from "#i18n";

  // Shadcn UI Components
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import Combobox from "$lib/components/ui/combobox/Combobox.svelte";

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
  let language = "en";
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
  let updateStatus = "idle"; // idle, checking, available, uptodate, error
  let updateData = null;

  // Advanced VAD Settings
  let vadSettings = {
    positiveSpeechThreshold: 0.8,
    negativeSpeechThreshold: 0.45,
    minSpeechMs: 100,
    redemptionMs: 50,
  };

  const LANGUAGES = [
    { code: "ja", name: "日本語" },
    { code: "en", name: "English" },
    { code: "zh", name: "中文" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "ko", name: "한국어" },
    { code: "auto", name: i18n.t("options.autoDetect") },
  ];

  const TARGET_LANGUAGES = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "zh-CN", name: "简体中文" },
    { code: "en", name: "English" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
  ];

  const TRANSLATION_SERVICES = [
    { id: "google", name: "Google Translate" },
    { id: "deepl", name: "DeepL" },
  ];

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
    if (confirm(i18n.t("profiles.deleteConfirm"))) {
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
      model.type,
      { quantization: "q4" },
    );
    profiles = [...profiles, newProfile];
    saveSettings();
    activeTab = "profiles";
    editProfile(newProfile); // Jump to edit page
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

  // Helpers for Select
  function getLanguageName(code) {
    return LANGUAGES.find((l) => l.code === code)?.name || code;
  }
  function getTargetLanguageName(code) {
    return TARGET_LANGUAGES.find((l) => l.code === code)?.name || code;
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
      {#if !editingProfileId}
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">{i18n.t("profiles.title")}</h2>
          <Button onclick={createProfile}
            >{i18n.t("profiles.newProfileBtn")}</Button
          >
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each profiles as profile}
            <Card.Root>
              <Card.Header>
                <Card.Title>{profile.name}</Card.Title>
              </Card.Header>
              <Card.Content>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <Badge
                      variant={profile.backend === "remote"
                        ? "destructive"
                        : "secondary"}>{profile.backend}</Badge
                    >
                  </div>
                  <span
                    class="text-sm text-muted-foreground truncate"
                    title={profile.model_id}>{profile.model_id || "N/A"}</span
                  >
                </div>
              </Card.Content>
              <Card.Footer class="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => editProfile(profile)}
                  >{i18n.t("profiles.edit")}</Button
                >
                <Button
                  variant="destructive"
                  size="sm"
                  onclick={() => deleteProfile(profile.id)}
                  >{i18n.t("profiles.delete")}</Button
                >
              </Card.Footer>
            </Card.Root>
          {/each}
        </div>
      {:else}
        <Card.Root>
          <Card.Header>
            <Card.Title>
              {profiles.find((p) => p.id === tempProfile.id)
                ? i18n.t("profiles.editTitle")
                : i18n.t("profiles.newTitle")}
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="grid gap-2">
              <Label for="profile-name">{i18n.t("profiles.nameLabel")}</Label>
              <Input
                id="profile-name"
                type="text"
                bind:value={tempProfile.name}
              />
            </div>

            <div class="grid gap-2">
              <Label>{i18n.t("profiles.backendLabel")}</Label>
              <RadioGroup.Root
                bind:value={tempProfile.backend}
                class="flex space-x-4"
              >
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="webgpu" id="backend-webgpu" />
                  <Label for="backend-webgpu"
                    >{i18n.t("profiles.localWebgpu")}</Label
                  >
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="wasm" id="backend-wasm" />
                  <Label for="backend-wasm"
                    >{i18n.t("profiles.localWasm")}</Label
                  >
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="remote" id="backend-remote" />
                  <Label for="backend-remote"
                    >{i18n.t("profiles.remoteApi")}</Label
                  >
                </div>
              </RadioGroup.Root>
            </div>

            {#if tempProfile.backend === "webgpu" || tempProfile.backend === "wasm"}
              <div class="grid gap-2">
                <Label for="model-id">{i18n.t("profiles.modelIdLabel")}</Label>
                <Input
                  id="model-id"
                  type="text"
                  bind:value={tempProfile.model_id}
                  placeholder="onnx-community/whisper-tiny"
                />
              </div>
              <div class="grid gap-2">
                <Label>{i18n.t("profiles.quantizationLabel")}</Label>
                <Combobox
                  value={tempProfile.quantization}
                  options={[
                    { value: "q4", label: "Q4 (Default)" },
                    { value: "int8", label: "Int8" },
                    { value: "fp32", label: "FP32" },
                  ]}
                  placeholder="Select quantization"
                  onSelect={(v) => (tempProfile.quantization = v)}
                />
              </div>
            {:else}
              <div class="grid gap-2">
                <Label for="api-endpoint"
                  >{i18n.t("profiles.apiEndpointLabel")}</Label
                >
                <Input
                  id="api-endpoint"
                  type="text"
                  bind:value={tempProfile.remote_endpoint}
                  placeholder="http://localhost:9000/v1/audio/transcriptions"
                />
              </div>
              <div class="grid gap-2">
                <Label for="api-key">{i18n.t("profiles.apiKeyLabel")}</Label>
                <Input
                  id="api-key"
                  type="password"
                  bind:value={tempProfile.remote_key}
                />
              </div>
            {/if}
          </Card.Content>
          <Card.Footer class="flex justify-end gap-2">
            <Button variant="outline" onclick={cancelEdit}
              >{i18n.t("profiles.cancelBtn")}</Button
            >
            <Button onclick={saveProfile}>{i18n.t("profiles.saveBtn")}</Button>
          </Card.Footer>
        </Card.Root>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="hub">
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">{i18n.t("hub.title")}</h2>
        {#if hubLoading}
          <div class="flex items-center justify-center p-8">
            <p class="text-muted-foreground">{i18n.t("hub.loading")}</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each hubModels as model}
              {#if model.type !== "remote"}
                <ModelHubCard
                  {model}
                  onCreate={() => createProfileFromModel(model)}
                />
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </Tabs.Content>

    <Tabs.Content value="settings">
      <Card.Root>
        <Card.Header>
          <Card.Title>{i18n.t("options.title")}</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-6">
          <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.translation")}</h3>
            <div class="flex items-center justify-between">
              <Label for="translation-mode"
                >{i18n.t("options.enableTranslation")}</Label
              >
              <Switch
                id="translation-mode"
                bind:checked={translationEnabled}
                onCheckedChange={saveSettings}
              />
            </div>
            {#if translationEnabled}
              <div class="flex items-center justify-between ml-4">
                <Label for="show-original"
                  >{i18n.t("options.showOriginal")}</Label
                >
                <Switch
                  id="show-original"
                  bind:checked={showOriginal}
                  onCheckedChange={saveSettings}
                />
              </div>

              <div class="grid gap-2">
                <Label>{i18n.t("options.translationService")}</Label>
                <Combobox
                  value={translationService}
                  options={TRANSLATION_SERVICES.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  onSelect={(v) => {
                    translationService = v;
                    saveSettings();
                  }}
                  class="w-full"
                />
              </div>

              <div class="grid gap-2">
                <Label>{i18n.t("options.targetLanguage")}</Label>
                <Combobox
                  value={targetLanguage}
                  options={TARGET_LANGUAGES.map((l) => ({
                    value: l.code,
                    label: l.name,
                  }))}
                  onSelect={(v) => {
                    targetLanguage = v;
                    saveSettings();
                  }}
                  searchable={true}
                  class="w-full"
                />
              </div>
            {/if}
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.language")}</h3>
            <div class="grid gap-2">
              <Label>{i18n.t("options.sourceLanguage")}</Label>
              <Combobox
                value={language}
                options={LANGUAGES.map((l) => ({
                  value: l.code,
                  label: l.name,
                }))}
                onSelect={(v) => {
                  language = v;
                  saveSettings();
                }}
                searchable={true}
                class="w-full"
              />
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.displayTab")}</h3>
            <div class="grid gap-2">
              <div class="flex justify-between">
                <Label>{i18n.t("options.fontSize")}</Label>
                <span class="text-sm text-muted-foreground">{fontSize}px</span>
              </div>
              <Slider
                value={[fontSize]}
                min={16}
                max={48}
                step={1}
                onValueChange={(v) => {
                  fontSize = v[0];
                  saveSettings();
                }}
              />
            </div>
            <div class="grid gap-2">
              <Label for="history-lines">{i18n.t("options.historyLines")}</Label
              >
              <Input
                id="history-lines"
                type="number"
                min="0"
                max="5"
                bind:value={historyLines}
                onchange={saveSettings}
              />
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("update.title")}</h3>
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <Label>{i18n.t("update.checkUpdate")}</Label>
                <span class="text-xs text-muted-foreground"
                  >{i18n.t("update.currentVersion")}
                  {browser.runtime.getManifest().version}</span
                >
              </div>
              <Button
                variant="outline"
                size="sm"
                onclick={handleCheckUpdate}
                disabled={updateStatus === "checking"}
              >
                {updateStatus === "checking"
                  ? i18n.t("update.checking")
                  : i18n.t("update.check")}
              </Button>
            </div>
            {#if updateStatus === "available"}
              <div
                class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-900"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-yellow-800 dark:text-yellow-200">
                      {i18n.t("update.available")}
                      {updateData.latestVersion}
                    </p>
                    <a
                      href={updateData.releaseUrl}
                      target="_blank"
                      class="text-sm underline text-yellow-700 dark:text-yellow-300"
                      >{i18n.t("update.viewRelease")}</a
                    >
                  </div>
                </div>
              </div>
            {:else if updateStatus === "uptodate"}
              <div class="text-sm text-green-600 dark:text-green-400">
                {i18n.t("update.isLatest")}
              </div>
            {:else if updateStatus === "error"}
              <div class="text-sm text-destructive">
                {i18n.t("update.checkFailed")}
              </div>
            {/if}
          </div>

          <div class="space-y-4 border-t pt-4">
            <h3 class="text-lg font-medium text-destructive">
              {i18n.t("advanced.debug")}
            </h3>
            <div class="flex gap-2 flex-wrap text-xs">
              <Button variant="secondary" size="sm" onclick={clearCache}
                >{i18n.t("advanced.clearCache")}</Button
              >
              <Button variant="outline" size="sm" onclick={listModels}
                >{i18n.t("advanced.checkCache")}</Button
              >
              <Button variant="destructive" size="sm" onclick={resetAllData}
                >{i18n.t("advanced.resetAll")}</Button
              >
            </div>
            <div class="text-xs text-muted-foreground">
              {i18n.t("advanced.debugDesc")}
            </div>
            {#if installedModels.length > 0}
              <div
                class="bg-muted p-2 rounded text-sm font-mono overflow-auto max-h-[100px]"
              >
                <ul>
                  {#each installedModels as m}<li>{m}</li>{/each}
                </ul>
              </div>
            {/if}
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="advanced">
      <AdvancedSettings bind:vadSettings onChange={saveSettings} />
    </Tabs.Content>
  </Tabs.Root>
</main>
