import { onMessage, sendMessage } from "$lib/messaging";
import { updatePipelineConfig } from "@/pipeline/PipelineConfig.ts";
import { pipelineController } from "@/pipeline/PipelineController.js";
import { audioRecorder } from "@/pipeline/AudioRecorder.js";
import { AsrEngine } from '@jeffpeng3/nemotron-asr-core';


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
    updatePipelineConfig(settings);
});




