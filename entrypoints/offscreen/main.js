import "@/pipeline/registry_loader.js";
import { onMessage } from "$lib/messaging";
import { updatePipelineConfig } from "@/pipeline/PipelineConfig.ts";
import { pipelineController } from "@/pipeline/PipelineController.js";
import { audioRecorder } from "@/pipeline/AudioRecorder.js";

console.log("HoneyWhisper Offscreen Script Loaded (Pipeline Architecture)");

onMessage('START_RECORDING', async (message) => {
    const settings = message.data.pipelineConfig || {};
    updatePipelineConfig(settings);
    await audioRecorder.startRecording(message.data.streamId);
});

onMessage('STOP_RECORDING', async () => {
    audioRecorder.stopRecording();
});

onMessage('UPDATE_SETTINGS', async (message) => {
    const settings = message.data || {};
    updatePipelineConfig(settings);
});

onMessage('DOWNLOAD_MODEL', async (message) => {
    const settings = message.data.pipelineConfig || {};
    await pipelineController.downloadModel(settings);
});

