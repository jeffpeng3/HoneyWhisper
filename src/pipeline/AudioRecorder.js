import { MicVAD } from "@ricky0123/vad-web";
import { sendMessage } from "$lib/messaging";
import { browser } from 'wxt/browser';
import { reportProgress } from "./ProgressTracker.js";
import { pipelineConfig } from "./PipelineConfig.ts";
import { pipelineController } from "./PipelineController.js";

export class AudioRecorder {
    constructor() {
        this.stream = null;
        this.vadInstance = null;
        this.audioContext = null;
        this.sourceNode = null;
    }

    async preloadVAD() {
        console.log("Preloading VAD assets...");
        const assets = [
            'silero_vad_v5.onnx',
            'vad.worklet.bundle.min.js'
        ];

        for (const asset of assets) {
            try {
                const url = browser.runtime.getURL(`assets/${asset}`);
                await fetch(url);
            } catch (e) {
                console.warn(`[Preload] Failed to fetch ${asset}:`, e);
            }
        }
        console.log("VAD assets preloaded.");
    }

    async startRecording(streamId) {
        if (this.vadInstance) return;

        try {
            await pipelineController.init();
            await this.preloadVAD();

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId
                    }
                },
                video: false
            });

            if (!this.audioContext) {
                this.audioContext = new AudioContext();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
            }
            this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
            this.sourceNode.connect(this.audioContext.destination);

            this.vadInstance = await MicVAD.new({
                getStream: () => this.stream,
                baseAssetPath: browser.runtime.getURL('/'),
                onnxWASMBasePath: browser.runtime.getURL('/'),
                positiveSpeechThreshold: pipelineConfig.vad.positiveSpeechThreshold,
                negativeSpeechThreshold: pipelineConfig.vad.negativeSpeechThreshold,
                redemptionMs: pipelineConfig.vad.redemptionMs,
                minSpeechMs: pipelineConfig.vad.minSpeechMs,
                model: 'v5',
                onSpeechStart: () => {
                    console.log("VAD: Speech Start");
                    sendMessage('VAD_STATUS', { status: 'speech' }).catch(() => { });
                },
                onSpeechEnd: (audio) => {
                    const lenSec = audio.length / 16000;
                    console.log(`VAD: Speech End (Length: ${lenSec.toFixed(2)}s)`);
                    sendMessage('VAD_STATUS', { status: 'quiet' }).catch(() => { });
                    pipelineController.generate(audio, true);
                },
                onVADMisfire: () => {
                    console.log("VAD: Misfire");
                    sendMessage('VAD_STATUS', { status: 'idle' }).catch(() => { });
                }
            });

            this.vadInstance.start();
            console.log("VAD Started");
            sendMessage('RECORDING_STARTED', undefined).catch(() => { });

        } catch (err) {
            console.error("Error starting recording:", err);
            reportProgress({ status: 'error', error: err.message });
        }
    }

    stopRecording() {
        pipelineController.processing = false;

        if (this.vadInstance) {
            this.vadInstance.pause();
            this.vadInstance = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        sendMessage('CLEAR', undefined).catch(() => { });

        pipelineController.releaseASR().catch(err => console.error("Error releasing pipeline:", err));
    }
}

export const audioRecorder = new AudioRecorder();
