import { BaseTranslator } from "@/pipeline/Translation/BaseTranslator.js";
import { BaseASR } from "@/pipeline/ASR/BaseASR.js";
import { sendMessage } from "$lib/messaging";
import { reportProgress } from "./ProgressTracker.js";
import { pipelineConfig } from "./PipelineConfig.ts";

export class PipelineController {
    constructor() {
        this.asrService = null;
        this.translatorService = null;
        this.processing = false;
        this.audioQueue = [];
        this.MAX_QUEUE_SIZE = 5;
    }

    async init() {
        // 1. Initialize ASR
        let desiredType = pipelineConfig.asr.type;

        // Fallback heuristic if type isn't explicitly set but model_id implies remote
        if (pipelineConfig.asr.model_id === 'remote' || pipelineConfig.asr.model_id.startsWith('http')) {
            desiredType = 'remote';
        }
        // If it's explicitly set to wasm, use that
        if (pipelineConfig.asr.type === 'wasm') {
            desiredType = 'wasm';
        }

        if (pipelineConfig.asr.model_id.includes('k2')) {
            desiredType = 'k2';
        }

        const TargetClass = BaseASR.get(desiredType);
        if (!TargetClass) {
            throw new Error(`ASR Backend '${desiredType}' not found in registry`);
        }

        if (!this.asrService || !(this.asrService instanceof TargetClass)) {
            await this.releaseASR();
            this.asrService = BaseASR.create(desiredType);
        }

        // Load Model
        reportProgress({ status: 'initiate', name: 'Whisper', file: 'Initializing Pipeline...' });

        const device = pipelineConfig.asr.type === 'wasm' ? 'wasm' : 'webgpu';

        try {
            await this.asrService.load({
                model_id: pipelineConfig.asr.model_id,
                quantization: pipelineConfig.asr.quantization,
                endpoint: pipelineConfig.asr.endpoint,
                apiKey: pipelineConfig.asr.key,
                device: device,
                language: pipelineConfig.asr.language,
                progress_callback: (data) => reportProgress(data)
            });
            reportProgress({ status: 'done' });
            console.log(`ASR Service Loaded: ${desiredType} (Device: ${device}, Language: ${pipelineConfig.asr.language})`);
        } catch (err) {
            console.error("ASR Load Error:", err);
            reportProgress({ status: 'error', error: err.message });
            throw err;
        }

        // 2. Initialize Translator
        const targetService = pipelineConfig.translation.service;
        if (!this.translatorService || this.translatorService.constructor.name.toLowerCase() !== targetService) {
            this.translatorService = BaseTranslator.create(targetService);
            console.log(`Translator Initialized: ${targetService}`);
        }
    }

    async releaseASR() {
        if (this.asrService) {
            await this.asrService.release();
            this.asrService = null;
        }
    }

    async processAudio(audio, isFinal) {
        if (this.processing) return;
        this.processing = true;

        try {
            if (!this.asrService) {
                throw new Error("Pipeline not initialized");
            }

            // 1. Transcribe
            const transcript = await this.asrService.transcribe(audio);
            let text = transcript.text;

            console.log(`Transcribed: "${text}"`);

            if (text.length > 0 && pipelineConfig.translation.enabled) {
                sendMessage('RESULT', {
                    text: text,
                    translatedText: null,
                    isFinal: false
                }).catch(() => { });
            }

            // 2. Translate
            let translatedText = null;
            if (text.length > 0 && pipelineConfig.translation.enabled) {
                try {
                    const translated = await this.translatorService.translate(text, pipelineConfig.asr.language, pipelineConfig.translation.target);
                    if (translated && translated !== text) {
                        console.log(`Translated: "${translated}"`);
                        translatedText = translated;
                    }
                } catch (translateErr) {
                    console.warn("Translation failed:", translateErr);
                }
            }

            // Apply "Show Original" logic
            if (translatedText && pipelineConfig.translation.enabled && pipelineConfig.translation.showOriginal === false) {
                text = translatedText;
                translatedText = null;
            }

            if (text.length > 0) {
                sendMessage('RESULT', {
                    text: text,
                    translatedText: translatedText,
                    isFinal: isFinal
                }).catch(() => { });
            }

        } catch (err) {
            console.error("Generation/Translation Error:", err);
        } finally {
            this.processing = false;
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.processing) return;
        if (this.audioQueue.length === 0) return;

        const { audio, isFinal } = this.audioQueue.shift();
        await this.processAudio(audio, isFinal);
    }

    async generate(audio, isFinal = true) {
        if (this.audioQueue.length >= this.MAX_QUEUE_SIZE) {
            console.warn("Processing busy, queue full. Dropping request.");
            sendMessage('PERFORMANCE_WARNING', {
                message: 'System overload. Try smaller model.'
            }).catch(() => { });
            return;
        }

        this.audioQueue.push({ audio, isFinal });
        this.processQueue();
    }

    async downloadModel(settings) {
        let desiredType = settings.asrBackend || 'webgpu';
        const modelId = settings.model_id || '';

        if (modelId.includes('k2')) {
            desiredType = 'k2';
        }

        try {
            const TargetClass = BaseASR.get(desiredType);
            if (!TargetClass) {
                throw new Error(`ASR Backend '${desiredType}' not found`);
            }

            const tempService = BaseASR.create(desiredType);
            const device = desiredType === 'wasm' ? 'wasm' : 'webgpu';

            reportProgress({ status: 'initiate', name: 'Download', file: 'Initializing Download...' });

            await tempService.download({
                model_id: modelId,
                quantization: settings.quantization || 'q4',
                device: device,
                language: settings.language || 'ja',
                progress_callback: (data) => reportProgress(data)
            });

            reportProgress({ status: 'done' });
            console.log(`Model downloaded to cache: ${modelId}`);

            sendMessage('DOWNLOAD_COMPLETE', undefined).catch(() => { });
        } catch (err) {
            console.error("Download Error:", err);
            reportProgress({ status: 'error', error: err.message });
        }
    }
}

export const pipelineController = new PipelineController();
