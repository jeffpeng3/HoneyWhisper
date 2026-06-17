import { onMessage } from "$lib/messaging";
import { updatePipelineConfig } from "@/pipeline/PipelineConfig.ts";
import { pipelineController } from "@/pipeline/PipelineController.js";
import { audioRecorder } from "@/pipeline/AudioRecorder.js";

console.log("HoneyWhisper Offscreen Script Loaded (Nemotron)");

pipelineController.preload().catch((err) => {
    console.error('Auto-preload failed:', err);
});

onMessage('START_RECORDING', async (message) => {
    const settings = message.data.pipelineConfig || {};
    updatePipelineConfig(settings);
    await audioRecorder.startRecording(message.data.streamId);
});

onMessage('STOP_RECORDING', async () => {
    await audioRecorder.stopRecording();
});

onMessage('UPDATE_SETTINGS', async (message) => {
    const settings = message.data || {};
    updatePipelineConfig(settings);
});
