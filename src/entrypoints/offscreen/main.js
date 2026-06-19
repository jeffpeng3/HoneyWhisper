import { onMessage, sendMessage } from "$lib/messaging";
import { asrConfig, translationConfig } from "$lib/settings/index.ts";
import { pipelineController } from "@/pipeline/PipelineController.js";
import { audioRecorder } from "@/pipeline/AudioRecorder.js";
import { AsrEngine } from '@jeffpeng3/nemotron-asr-core';

async function ensureEngine() {
    const isGemini = asrConfig.engine === 'gemini';
    const isGeminiLoaded = pipelineController.asr?.providesTranslation;
    if (pipelineController.asr && isGemini === isGeminiLoaded) return;
    await pipelineController.setEngine(asrConfig.engine);
    await pipelineController.preload();
}

function getBrowserStorage() {
    var b = globalThis.browser || globalThis.chrome || null;
    return b && b.storage || null;
}

async function init() {
    await Promise.all([asrConfig.load(), translationConfig.load()]);
    console.log("HoneyWhisper Offscreen Script Loaded");
    var storage = getBrowserStorage();
    if (storage && storage.onChanged) {
        storage.onChanged.addListener(function(changes, areaName) {
            if (changes.translation) pipelineController.syncTranslator();
        });
    }
    ensureEngine().catch(function(err) { return console.error('Auto-preload failed:', err); });
}

init();

onMessage('START_RECORDING', async (message) => {
    await ensureEngine();
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
