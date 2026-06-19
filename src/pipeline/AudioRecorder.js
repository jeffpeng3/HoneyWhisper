import { sendMessage } from "$lib/messaging";
import { asrConfig } from "$lib/settings/index.ts";
import { pipelineController } from "./PipelineController.js";

const FLUSH_SAMPLES = 3200;

export class AudioRecorder {
    constructor() {
        this.stream = null;
        this.passthroughCtx = null;
        this.passthroughSource = null;
        this.asrCtx = null;
        this.asrSource = null;
        this.workletNode = null;
        this.audioBuffer = [];
        this.recording = false;
    }

    async startRecording(streamId) {
        try {
            const lang = asrConfig.engine === 'gemini' ? asrConfig.gemini.language : asrConfig.nemotron.language;
            await pipelineController.startStreaming(lang);

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        chromeMediaSourceId: streamId,
                    },
                },
                video: false,
            });

            // --- Native passthrough: user hears original tab audio ---
            this.passthroughCtx = new AudioContext();
            if (this.passthroughCtx.state === 'suspended') {
                await this.passthroughCtx.resume();
            }
            this.passthroughSource = this.passthroughCtx.createMediaStreamSource(this.stream);
            this.passthroughSource.connect(this.passthroughCtx.destination);

            // --- ASR processing at 16kHz (downsampled by browser automatically) ---
            this.asrCtx = new AudioContext({ sampleRate: 16000 });
            if (this.asrCtx.state === 'suspended') {
                await this.asrCtx.resume();
            }
            this.asrSource = this.asrCtx.createMediaStreamSource(this.stream);

            const workletUrl = chrome.runtime.getURL('/worklets/passthrough-processor.js');
            await this.asrCtx.audioWorklet.addModule(workletUrl);

            this.workletNode = new AudioWorkletNode(this.asrCtx, 'passthrough-processor');
            this.audioBuffer = [];

            this.workletNode.port.onmessage = (e) => {
                if (!this.recording) return;
                this.audioBuffer.push(e.data);
                const total = this.audioBuffer.reduce((sum, c) => sum + c.length, 0);
                if (total >= FLUSH_SAMPLES) {
                    const combined = new Float32Array(total);
                    let offset = 0;
                    for (const chunk of this.audioBuffer) {
                        combined.set(chunk, offset);
                        offset += chunk.length;
                    }
                    this.audioBuffer = [];
                    pipelineController.feedAudio(combined).catch((err) => {
                        console.error('Audio processing error:', err);
                    });
                }
            };

            this.asrSource.connect(this.workletNode);
            this.recording = true;

            sendMessage('RECORDING_STARTED', undefined).catch(() => {});
            console.log('[AudioRecorder] Recording started');
        } catch (err) {
            console.error('Error starting recording:', err);
            sendMessage('ASR_ERROR', { error: err.message }).catch(() => {});
        }
    }

    async stopRecording() {
        this.recording = false;
        this.audioBuffer = [];

        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.close();
            this.workletNode = null;
        }
        if (this.asrSource) {
            this.asrSource.disconnect();
            this.asrSource = null;
        }
        if (this.asrCtx) {
            await this.asrCtx.close();
            this.asrCtx = null;
        }
        if (this.passthroughSource) {
            this.passthroughSource.disconnect();
            this.passthroughSource = null;
        }
        if (this.passthroughCtx) {
            await this.passthroughCtx.close();
            this.passthroughCtx = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }

        if (this.audioBuffer.length > 0) {
            const total = this.audioBuffer.reduce((sum, c) => sum + c.length, 0);
            const combined = new Float32Array(total);
            let offset = 0;
            for (const chunk of this.audioBuffer) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }
            this.audioBuffer = [];
            await pipelineController.feedAudio(combined).catch(() => {});
        }

        await pipelineController.stop();
        console.log('[AudioRecorder] Recording stopped');
    }
}

export const audioRecorder = new AudioRecorder();
