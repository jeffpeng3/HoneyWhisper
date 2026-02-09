<script>
  import { onMount } from "svelte";
  import { ModelRegistry, DEFAULT_PROFILES } from "../lib/ModelRegistry.js";
  import ModelHubCard from "./ModelHubCard.svelte";
  import { ModeWatcher } from "mode-watcher";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  // Shadcn UI Components
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";

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
          "https://raw.githubusercontent.com/jeffpeng3/HoneyWhisper/refs/heads/master/public/models.json",
        );
        if (res.ok) {
          const remoteModels = await res.json();
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

  // Helpers for Select
  function getLanguageName(code) {
    return LANGUAGES.find((l) => l.code === code)?.name || code;
  }
  function getTargetLanguageName(code) {
    return TARGET_LANGUAGES.find((l) => l.code === code)?.name || code;
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
    <Tabs.List class="grid w-full grid-cols-3 mb-6">
      <Tabs.Trigger value="profiles">profiles</Tabs.Trigger>
      <Tabs.Trigger value="hub">Model Hub</Tabs.Trigger>
      <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
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
                  list="common-models"
                  bind:value={tempProfile.model_id}
                />
                <datalist id="common-models">
                  <option value="onnx-community/whisper-tiny"></option>
                  <option value="onnx-community/whisper-base"></option>
                  <option value="onnx-community/whisper-small"></option>
                </datalist>
              </div>
              <div class="grid gap-2">
                <Label>Quantization</Label>
                <Select.Root
                  selected={{
                    value: tempProfile.quantization,
                    label:
                      tempProfile.quantization === "q4"
                        ? "Q4 (Default)"
                        : tempProfile.quantization === "int8"
                          ? "Int8"
                          : "FP32",
                  }}
                  onSelectedChange={(v) => (tempProfile.quantization = v.value)}
                >
                  <Select.Trigger class="w-full">
                    {tempProfile.quantization
                      ? tempProfile.quantization === "q4"
                        ? "Q4 (Default)"
                        : tempProfile.quantization === "int8"
                          ? "Int8"
                          : "FP32"
                      : "Select quantization"}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="q4" label="Q4 (Default)"
                      >Q4 (Default)</Select.Item
                    >
                    <Select.Item value="int8" label="Int8">Int8</Select.Item>
                    <Select.Item value="fp32" label="FP32">FP32</Select.Item>
                  </Select.Content>
                </Select.Root>
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
              <div class="grid gap-2">
                <Label>Target Language</Label>
                <Select.Root
                  selected={{
                    value: targetLanguage,
                    label: getTargetLanguageName(targetLanguage),
                  }}
                  onSelectedChange={(v) => {
                    targetLanguage = v.value;
                    saveSettings();
                  }}
                >
                  <Select.Trigger class="w-full">
                    {getTargetLanguageName(targetLanguage)}
                  </Select.Trigger>
                  <Select.Content class="max-h-[200px] overflow-y-auto">
                    {#each TARGET_LANGUAGES as lang}
                      <Select.Item value={lang.code} label={lang.name}
                        >{lang.name}</Select.Item
                      >
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
            {/if}
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-medium">Recognition</h3>
            <div class="grid gap-2">
              <Label>Source Language</Label>
              <Select.Root
                selected={{ value: language, label: getLanguageName(language) }}
                onSelectedChange={(v) => {
                  language = v.value;
                  saveSettings();
                }}
              >
                <Select.Trigger class="w-full">
                  {getLanguageName(language)}
                </Select.Trigger>
                <Select.Content class="max-h-[200px] overflow-y-auto">
                  {#each LANGUAGES as lang}
                    <Select.Item value={lang.code} label={lang.name}
                      >{lang.name}</Select.Item
                    >
                  {/each}
                </Select.Content>
              </Select.Root>
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

          <div class="space-y-4 border-t pt-4">
            <h3 class="text-lg font-medium text-destructive">Debug</h3>
            <div class="flex gap-2">
              <Button variant="destructive" size="sm" onclick={clearCache}
                >Clear Cache</Button
              >
              <Button variant="outline" size="sm" onclick={listModels}
                >Check Cache</Button
              >
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
  </Tabs.Root>
</main>
