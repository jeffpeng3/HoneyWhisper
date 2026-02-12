<script>
  import { onMount } from "svelte";
  import { ModelRegistry, DEFAULT_PROFILES } from "../lib/ModelRegistry.js";
  import ModelHubCard from "./ModelHubCard.svelte";
  import AdvancedSettings from "./AdvancedSettings.svelte";
  import { ModeWatcher } from "mode-watcher";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { checkUpdate } from "../lib/version.js";

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
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese (中文)" },
    { code: "ja", name: "Japanese (日本語)" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "ko", name: "Korean" },
    { code: "auto", name: "Auto Detect(不穩定)" },
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

  const TRANSLATION_SERVICES = [
    { id: "google", name: "Google Translate" },
    { id: "deepl", name: "DeepL" },
  ];

  onMount(async () => {
    loadSettings();
    loadHubModels();
    handleCheckUpdate();
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
        translationService: "google",
        targetLanguage: "zh-TW",
        showOriginal: true,
        // VAD Defaults
        vad: {
          positiveSpeechThreshold: 0.8,
          negativeSpeechThreshold: 0.45,
          minSpeechMs: 100,
          redemptionMs: 50,
        },
      },
      (items) => {
        profiles = items.profiles || DEFAULT_PROFILES;
        language = items.language;
        fontSize = parseInt(items.fontSize);
        historyLines = parseInt(items.historyLines);
        translationEnabled = items.translationEnabled;
        translationService = items.translationService || "google";
        targetLanguage = items.targetLanguage;
        showOriginal =
          items.showOriginal !== undefined ? items.showOriginal : true;

        // Merge defaults just in case
        vadSettings = { ...vadSettings, ...(items.vad || {}) };
      },
    );
  }

  async function loadHubModels() {
    hubLoading = true;
    try {
      const { models, error } = await ModelRegistry.fetchModels();
      hubModels = models;
      if (error) {
        showStatus(
          "Failed to load latest models from GitHub. Using local backup.",
        );
        console.warn("Hub Load Error:", error);
      }
    } catch (e) {
      console.error("Error loading hub:", e);
      hubModels = [];
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
        translationService,
        targetLanguage,
        showOriginal,
        vad: vadSettings,
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
            settings: {
              translationEnabled,
              translationService,
              targetLanguage,
              language,
              showOriginal,
              vad: vadSettings,
            },
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
      model.type,
      { quantization: "q4" },
    );
    profiles = [...profiles, newProfile];
    saveSettings();
    activeTab = "profiles";
    editProfile(newProfile); // Jump to edit page
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

  async function resetAllData() {
    if (
      confirm(
        "Are you sure you want to delete ALL data? This will remove all profiles, settings, and downloaded models. This action cannot be undone.",
      )
    ) {
      try {
        await chrome.storage.sync.clear();
        await chrome.storage.local.clear();

        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));

        showStatus("All data reset. Reloading defaults...");

        // Reload default settings
        loadSettings();
        installedModels = [];
      } catch (err) {
        alert("Error resetting data: " + err.message);
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
    const result = await checkUpdate();
    if (result.error) {
      updateStatus = "error";
      showStatus("Error checking for update");
    } else if (result.hasUpdate) {
      updateStatus = "available";
      updateData = result;
    } else {
      updateStatus = "uptodate";
      updateData = result;
    }
  }
</script>

<ModeWatcher />

<main class="container mx-auto p-4 max-w-4xl">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">HoneyWhisper</h1>
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
      <Tabs.Trigger value="profiles">profiles</Tabs.Trigger>
      <Tabs.Trigger value="hub">Model Hub</Tabs.Trigger>
      <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
      <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="profiles">
      {#if !editingProfileId}
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">My Profiles</h2>
          <Button onclick={createProfile}>+ New Profile</Button>
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
                  onclick={() => editProfile(profile)}>Edit</Button
                >
                <Button
                  variant="destructive"
                  size="sm"
                  onclick={() => deleteProfile(profile.id)}>Delete</Button
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
                ? "Edit Profile"
                : "New Profile"}
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="grid gap-2">
              <Label for="profile-name">Profile Name</Label>
              <Input
                id="profile-name"
                type="text"
                bind:value={tempProfile.name}
              />
            </div>

            <div class="grid gap-2">
              <Label>Backend</Label>
              <RadioGroup.Root
                bind:value={tempProfile.backend}
                class="flex space-x-4"
              >
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="webgpu" id="backend-webgpu" />
                  <Label for="backend-webgpu">Local (WebGPU)</Label>
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="wasm" id="backend-wasm" />
                  <Label for="backend-wasm">Local (WASM)</Label>
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value="remote" id="backend-remote" />
                  <Label for="backend-remote">Remote (API)</Label>
                </div>
              </RadioGroup.Root>
            </div>

            {#if tempProfile.backend === "webgpu" || tempProfile.backend === "wasm"}
              <div class="grid gap-2">
                <Label for="model-id">Model ID (HuggingFace)</Label>
                <Input
                  id="model-id"
                  type="text"
                  bind:value={tempProfile.model_id}
                  placeholder="onnx-community/whisper-tiny"
                />
              </div>
              <div class="grid gap-2">
                <Label>Quantization</Label>
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
                <Label for="api-endpoint">API Endpoint</Label>
                <Input
                  id="api-endpoint"
                  type="text"
                  bind:value={tempProfile.remote_endpoint}
                  placeholder="http://localhost:9000/v1/audio/transcriptions"
                />
              </div>
              <div class="grid gap-2">
                <Label for="api-key">API Key (Optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  bind:value={tempProfile.remote_key}
                />
              </div>
            {/if}
          </Card.Content>
          <Card.Footer class="flex justify-end gap-2">
            <Button variant="outline" onclick={cancelEdit}>Cancel</Button>
            <Button onclick={saveProfile}>Save Profile</Button>
          </Card.Footer>
        </Card.Root>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="hub">
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">Model Hub</h2>
        {#if hubLoading}
          <div class="flex items-center justify-center p-8">
            <p class="text-muted-foreground">Loading models...</p>
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
          <Card.Title>Settings</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-6">
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Translation</h3>
            <div class="flex items-center justify-between">
              <Label for="translation-mode">Enable Real-time Translation</Label>
              <Switch
                id="translation-mode"
                bind:checked={translationEnabled}
                onCheckedChange={saveSettings}
              />
            </div>
            {#if translationEnabled}
              <div class="flex items-center justify-between ml-4">
                <Label for="show-original">Show Original Text</Label>
                <Switch
                  id="show-original"
                  bind:checked={showOriginal}
                  onCheckedChange={saveSettings}
                />
              </div>

              <div class="grid gap-2">
                <Label>Service</Label>
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
                <Label>Target Language</Label>
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
            <h3 class="text-lg font-medium">Recognition</h3>
            <div class="grid gap-2">
              <Label>Source Language</Label>
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
            <h3 class="text-lg font-medium">Appearance</h3>
            <div class="grid gap-2">
              <div class="flex justify-between">
                <Label>Subtitle Size</Label>
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
              <Label for="history-lines">History Lines</Label>
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
            <h3 class="text-lg font-medium">Updates</h3>
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <Label>Check for Updates</Label>
                <span class="text-xs text-muted-foreground"
                  >Current Version: {chrome.runtime.getManifest().version}</span
                >
              </div>
              <Button
                variant="outline"
                size="sm"
                onclick={handleCheckUpdate}
                disabled={updateStatus === "checking"}
              >
                {updateStatus === "checking"
                  ? "Checking..."
                  : "Check for Update"}
              </Button>
            </div>
            {#if updateStatus === "available"}
              <div
                class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-900"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-yellow-800 dark:text-yellow-200">
                      Update Available: {updateData.latestVersion}
                    </p>
                    <a
                      href={updateData.releaseUrl}
                      target="_blank"
                      class="text-sm underline text-yellow-700 dark:text-yellow-300"
                      >View Release</a
                    >
                  </div>
                </div>
              </div>
            {:else if updateStatus === "uptodate"}
              <div class="text-sm text-green-600 dark:text-green-400">
                You are using the latest version.
              </div>
            {:else if updateStatus === "error"}
              <div class="text-sm text-destructive">
                Failed to check for updates.
              </div>
            {/if}
          </div>

          <div class="space-y-4 border-t pt-4">
            <h3 class="text-lg font-medium text-destructive">Debug</h3>
            <div class="flex gap-2 flex-wrap text-xs">
              <Button variant="secondary" size="sm" onclick={clearCache}
                >Clear Cache</Button
              >
              <Button variant="outline" size="sm" onclick={listModels}
                >Check Cache</Button
              >
              <Button variant="destructive" size="sm" onclick={resetAllData}
                >Reset All Data</Button
              >
            </div>
            <div class="text-xs text-muted-foreground">
              * Reset All Data will remove all profiles, settings, and
              downloaded models.
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
