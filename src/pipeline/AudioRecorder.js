import { MicVAD } from "@ricky0123/vad-web";
import { sendMessage } from "$lib/messaging";
import { browser } from 'wxt/browser';
import { reportProgress } from "./ProgressTracker.js";
import { pipelineConfig } from "./PipelineConfig.ts";
import { pipelineController } from "./PipelineController.js";
import { SlidingWindowProcessor } from "./SlidingWindowProcessor.js";

export class AudioRecorder {
    constructor() {
        this.stream = null;
        this.vadInstance = null;
        this.audioContext = null;
        this.sourceNode = null;

        // Sliding window mode (using micVAD for audio processing)
        this.slidingWindowProcessor = null;
    }

    async preloadVAD() {
        console.log("Preloading VAD assets...");
        const assets = [
            'silero_vad_v5.onnx',
            'vad.worklet.bundle.min.js'
        ];

        for (const asset of assets) {
            try {
                const url = browser.runtime.getURL(`${asset}`);
                await fetch(url);
            } catch (e) {
                console.warn(`[Preload] Failed to fetch ${asset}:`, e);
            }
        }
        console.log("VAD assets preloaded.");
    }

    async startRecording(streamId) {
        if (this.vadInstance || this.workletNode) return;

        try {
            await pipelineController.init();

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

            if (pipelineConfig.audioMode === 'sliding_window') {
                console.log('[AudioRecorder] Mode: Sliding Window');
                await this._startSlidingWindowMode();
            } else {
                console.log('[AudioRecorder] Mode: VAD');
                await this._startVADMode();
            }

            sendMessage('RECORDING_STARTED', undefined).catch(() => { });
        } catch (err) {
            console.error("Error starting recording:", err);
            reportProgress({ status: 'error', error: err.message });
        }
    }

    /** @private */
    async _startVADMode() {
        await this.preloadVAD();

        this.vadInstance = await MicVAD.new({
            getStream: () => this.stream,
            baseAssetPath: browser.runtime.getURL('/'),
            onnxWASMBasePath: browser.runtime.getURL('/'),
            positiveSpeechThreshold: pipelineConfig.vad.positiveSpeechThreshold,
            negativeSpeechThreshold: pipelineConfig.vad.negativeSpeechThreshold,
            redemptionMs: pipelineConfig.vad.redemptionMs,
            minSpeechMs: pipelineConfig.vad.minSpeechMs,
            model: 'v5',
            onSpeechRealStart: () => {
                console.log("VAD: Speech Start");
                sendMessage('VAD_STATUS', { status: 'speech' }).catch(() => { });
            },
            onSpeechEnd: (audio) => {
                const lenSec = audio.length / 16000;
                console.log(`VAD: Speech End (Length: ${lenSec.toFixed(2)}s)`);
                sendMessage('VAD_STATUS', { status: 'quiet' }).catch(() => { });
                pipelineController.generate(audio, true);
            },
            // onVADMisfire: () => {
            //     console.log("VAD: Misfire");
            //     sendMessage('VAD_STATUS', { status: 'idle' }).catch(() => { });
            // },
            onFrameProcessed: (frame) => {
                console.log("VAD: Frame Processed", frame);
            }
        });

        this.vadInstance.start();
        console.log("VAD Started");
    }

    /** @private */
    async _startSlidingWindowMode() {
        const { windowSeconds, stepSeconds, volumeThreshold } = pipelineConfig.slidingWindow;

        // 直接使用 micVAD 處理 audio，自製 resampler-worklet
        this.vadInstance = await MicVAD.new({
            getStream: () => this.stream,
            baseAssetPath: browser.runtime.getURL('/'),
            onnxWASMBasePath: browser.runtime.getURL('/'),
            positiveSpeechThreshold: 1,
            negativeSpeechThreshold: 0,
            model: 'v5',
            sampleRate: 16000,
            onFrameProcessed: (probs, frame) => {
                if (frame && frame.length > 0) {
                    this.slidingWindowProcessor.feed(frame);
                }
            }
        });

        // Initialize sliding window processor
        this.slidingWindowProcessor = new SlidingWindowProcessor({
            windowSeconds,
            stepSeconds,
            volumeThreshold,
            sampleRate: 16000,
            onWindowReady: (audioChunk) => {
                pipelineController.generateSlidingWindow(audioChunk);
            }
        });

        // Start micVAD to process audio stream at 16kHz
        this.vadInstance.start();
        console.log(`[AudioRecorder] Sliding Window Mode`);
    }

    stopRecording() {
        pipelineController.processing = false;

        // Stop VAD 
        if (this.vadInstance) {
            this.vadInstance.pause();
            this.vadInstance = null;
        }

        // Stop Sliding Window processor
        if (this.slidingWindowProcessor) {
            this.slidingWindowProcessor.reset();
            this.slidingWindowProcessor = null;
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

        // Flush any remaining text in sliding window mode
        pipelineController.flushStitcher();
        pipelineController.releaseASR().catch(err => console.error("Error releasing pipeline:", err));
        console.log('[AudioRecorder] Recording stopped');
    }
}

export const audioRecorder = new AudioRecorder();
