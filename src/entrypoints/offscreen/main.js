import { onMessage, sendMessage } from "$lib/messaging";
import { updatePipelineConfig, pipelineConfig } from "@/pipeline/PipelineConfig.ts";
import { pipelineController } from "@/pipeline/PipelineController.js";
import { audioRecorder } from "@/pipeline/AudioRecorder.js";
import { AsrEngine } from '@jeffpeng3/nemotron-asr-core';
import { getLocalSettings } from "$lib/local-settings";


console.log("HoneyWhisper Offscreen Script Loaded");

pipelineController.preload().catch((err) => {
    console.error('Auto-preload failed:', err);
});

onMessage('START_RECORDING', async (message) => {
    const settings = message.data.pipelineConfig || {};
    const local = await getLocalSettings();
    settings.geminiApiKey = local.geminiApiKey;
    const prevEngine = pipelineConfig.asr.engine;
    updatePipelineConfig(settings);
    if (settings.asrBackend && settings.asrBackend !== prevEngine) {
        await pipelineController.setEngine(settings.asrBackend);
        await pipelineController.preload();
    }
    pipelineController.syncTranslator();
    await audioRecorder.startRecording(message.data.streamId);
});

onMessage('STOP_RECORDING', async () => {
    await audioRecorder.stopRecording();
});

onMessage('BENCHMARK_ASR', async (message) => {
    const wasmPaths = chrome.runtime.getURL('/');
    const beamWidths = message.data.beamWidths || [1, 2, 3];
    let allResults = [];
    const engine = new AsrEngine({
        status: (detail) => {
            const m = detail.match(/^\[bench\] (\S+) \((\S+)\): ([\d.]+) RTF$/);
            if (m) {
                const profile = m[1];
                const bw = m[2] === "greedy" ? 1 : parseInt(m[2].replace("beam=", ""));
                const rtf = parseFloat(m[3]);
                sendMessage('BENCHMARK_RESULT', [{ profile, beamWidth: bw, rtf, latencyLabel: "" }]).catch(() => {});
            }
        }
    }, { wasmPaths });
    const raw = await engine.benchmark({ beamWidths, forceAll: true });
    allResults = raw.map((r) => ({
        profile: r.profile,
        beamWidth: r.beamWidth,
        rtf: r.rtf,
        latencyLabel: r.latencyLabel,
    }));
    return allResults;
});

onMessage('UPDATE_SETTINGS', async (message) => {
    const settings = message.data || {};
    const local = await getLocalSettings();
    if (local.geminiApiKey) settings.geminiApiKey = local.geminiApiKey;
    const prevEngine = pipelineConfig.asr.engine;
    updatePipelineConfig(settings);
    if (settings.asrBackend && settings.asrBackend !== prevEngine) {
        await pipelineController.setEngine(settings.asrBackend);
        await pipelineController.preload();
    }
    pipelineController.syncTranslator();
});




