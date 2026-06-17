<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "wxt/browser";
  import { ModeWatcher } from "mode-watcher";
  import { sendMessage, onMessage } from "$lib/messaging";
  import { i18n } from "#i18n";

  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import { Settings, Mic, MicOff, LoaderCircle, Download } from "lucide-svelte";

  let isRecording = false;
  let isLoading = false;
  let modelReady = false;
  let isDownloading = false;
  let initProgress = 0;
  let initText = "";

  let activeTabTitle = i18n.t("popup.tabNameFallback");
  let cleanupListeners = [];

  onMount(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      activeTabTitle = tab?.title || i18n.t("popup.tabNameFallback");
    } catch (e) {
      console.warn('Popup: failed to get tab info', e);
    }

    try {
      const state = await sendMessage('GET_STATE', undefined);
      if (state.isRecording) {
        isRecording = true;
      }
      if (state.modelReady) {
        modelReady = true;
      } else {
        isDownloading = true;
        sendMessage('INIT_MODEL', undefined).catch(() => {});
      }
    } catch (e) {
      console.warn('Popup: background not ready yet, retrying', e);
      isDownloading = true;
      sendMessage('INIT_MODEL', undefined).catch(() => {});
    }

    const unsub1 = onMessage('RECORDING_STARTED', () => {
      isRecording = true;
      isLoading = false;
    });

    const unsub2 = onMessage('DOWNLOAD_PROGRESS', (message) => {
      const data = message.data;
      if (data.cached) {
        initProgress = 100;
        isDownloading = false;
        modelReady = true;
        return;
      }
      isDownloading = true;
      initProgress = data.progress || 0;
      initText = data.file || "";
    });

    const unsub3 = onMessage('MODEL_READY', () => {
      isDownloading = false;
      modelReady = true;
    });

    cleanupListeners = [unsub1, unsub2, unsub3];
  });

  onDestroy(() => {
    cleanupListeners.forEach(fn => fn());
  });

  async function toggleRecording() {
    if (isRecording) {
      isLoading = true;
      try {
        await sendMessage('REQUEST_STOP', undefined);
      } catch (e) {}
      isLoading = false;
      isRecording = false;
    } else {
      isLoading = true;
      try {
        await sendMessage('REQUEST_START', undefined);
      } catch (e) {
        isLoading = false;
      }
    }
  }

  function openSettings() {
    browser.runtime.openOptionsPage();
  }
</script>

<ModeWatcher />

<div class="w-[320px] p-4 space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-lg font-bold">{i18n.t("name")}</h1>
    <Badge variant={isRecording ? "destructive" : "secondary"}>
      {isRecording ? i18n.t("popup.recording") : i18n.t("popup.idle")}
    </Badge>
  </div>

  {#if isDownloading}
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Download class="w-4 h-4" />
        <span>{i18n.t("popup.downloadingModel")}</span>
      </div>
      <Progress value={initProgress} />
      <p class="text-xs text-muted-foreground truncate">{initText}</p>
    </div>
  {/if}

  <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground truncate">
    <span class="truncate">{activeTabTitle}</span>
  </div>

  <div class="flex gap-2">
    <Button
      class="flex-1"
      variant={isRecording ? "destructive" : "default"}
      onclick={toggleRecording}
      disabled={isLoading || (!modelReady && !isRecording)}
    >
      {#if isLoading}
        <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
      {:else if isRecording}
        <MicOff class="w-4 h-4 mr-2" />
      {:else}
        <Mic class="w-4 h-4 mr-2" />
      {/if}
      {isRecording ? i18n.t("popup.stop") : i18n.t("popup.start")}
    </Button>
    <Button variant="outline" size="icon" onclick={openSettings} title={i18n.t("popup.settings")}>
      <Settings class="w-4 h-4" />
    </Button>
  </div>
</div>
