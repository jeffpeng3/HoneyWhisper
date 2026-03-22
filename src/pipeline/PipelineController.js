import { BaseTranslator } from "@/pipeline/Translation/BaseTranslator.js";
import { ASRWorkerWrapper } from "./ASR/ASRWorkerWrapper.js";
import { sendMessage } from "$lib/messaging";
import { reportProgress } from "./ProgressTracker.js";
import { pipelineConfig } from "./PipelineConfig.ts";
import { TextStitcher } from "./TextStitcher.js";

export class PipelineController {
    constructor() {
        this.asrService = null;
        this.translatorService = null;
        this.processing = false;
        this.audioQueue = [];
        this.MAX_QUEUE_SIZE = 3;
        this.textStitcher = new TextStitcher();
        this.slidingWindowCommittedLength = 0; // Tracks text already emitted as isFinal in sliding window mode
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

        if (!this.asrService || this.asrService.type !== desiredType) {
            await this.releaseASR();
            this.asrService = new ASRWorkerWrapper(desiredType);
            this.asrService.type = desiredType;
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

        // 3. Reset text stitcher for new session
        this.textStitcher.reset();
    }

    async releaseASR() {
        if (this.asrService) {
            await this.asrService.release();
            this.asrService = null;
        }
    }

    /**
     * Process audio in VAD mode (original flow).
     */
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

    /**
     * Process audio in sliding window mode with text stitching.
     */
    async processSlidingWindowAudio(audio) {
        if (this.processing) return;
        this.processing = true;

        try {
            if (!this.asrService) {
                throw new Error("Pipeline not initialized");
            }

            console.log(`[SlidingWindow] Processing window: ${(audio.length / 16000).toFixed(1)}s, queue=${this.audioQueue.length}`);

            // 1. Transcribe the full window
            const transcript = await this.asrService.transcribe(audio);
            const rawText = transcript.text;

            if (!rawText || rawText.trim().length === 0) {
                console.log('[SlidingWindow] No speech detected in window');
                this.processing = false;
                return;
            }

            console.log(`[SlidingWindow] Raw: "${rawText}"`);

            // 2. Stitch with previous text (updates textStitcher internal state)
            this.textStitcher.stitch(rawText);
            const globalText = this.textStitcher.getFullText();

            // 3. Extract uncommitted portion
            if (globalText.length <= this.slidingWindowCommittedLength) {
                this.processing = false;
                return;
            }

            let uncommittedText = globalText.slice(this.slidingWindowCommittedLength);
            
            // Track stability for Pause detection (Option 2 - if text hasn't changed, user paused)
            if (this.lastUncommittedText === uncommittedText && uncommittedText.length > 0) {
                this.uncommittedStableCount = (this.uncommittedStableCount || 0) + 1;
            } else {
                this.uncommittedStableCount = 0;
                this.lastUncommittedText = uncommittedText;
            }

            // 4. Check for punctuation to finalize sentences
            const strongPuncs = ['。', '！', '？', '.', '!', '?', '\n'];
            let lastPuncIndex = -1;
            for (const p of strongPuncs) {
                const idx = uncommittedText.lastIndexOf(p);
                if (idx > lastPuncIndex) lastPuncIndex = idx;
            }

            let textToCommit = null;
            let interimText = uncommittedText;

            // Trigger 1: Strong Punctuation
            if (lastPuncIndex !== -1) {
                textToCommit = uncommittedText.slice(0, lastPuncIndex + 1);
                interimText = uncommittedText.slice(lastPuncIndex + 1);
            } 
            // Trigger 2: Pause / Silence detection (1 stable cycle = ~2s pause)
            else if (this.uncommittedStableCount >= 1 && uncommittedText.length > 0) {
                console.log("[SlidingWindow] Finalized due to 2s pause (text stability)");
                textToCommit = uncommittedText;
                interimText = "";
            }
            // Trigger 3: Fallback length limit (prevent endless strings without punctuation)
            else if (uncommittedText.length > 40) {
                console.log("[SlidingWindow] Finalized due to 40+ char limit fallback");
                // Try to find a weak punctuation (comma, space) in the first 25 chars
                const weakPuncs = ['、', ',', ' ', '，'];
                let breakIdx = -1;
                for (const p of weakPuncs) {
                    const idx = uncommittedText.indexOf(p, 15);
                    if (idx !== -1 && (breakIdx === -1 || idx < breakIdx)) {
                        breakIdx = idx;
                    }
                }
                
                // If no weak punctuation, just cut aggressively at 25
                if (breakIdx === -1) breakIdx = 25;
                else breakIdx += 1; // include the space/comma
                
                textToCommit = uncommittedText.slice(0, breakIdx);
                interimText = uncommittedText.slice(breakIdx);
            }

            if (textToCommit) {
                this.slidingWindowCommittedLength += textToCommit.length;
                this.lastUncommittedText = interimText;
                this.uncommittedStableCount = 0;
            }

            console.log(`[SlidingWindow] Uncommitted: "${uncommittedText}" -> Commit: "${textToCommit || ''}", Interim: "${interimText}"`);

            // 5. Build and send messages

            // Helper to translate and send a chunk
            const sendChunk = async (text, isFinal) => {
                if (!text || text.length === 0) return;

                let translatedText = null;
                if (pipelineConfig.translation.enabled) {
                    // Send original immediately as interim/final fallback
                    sendMessage('RESULT', { text, translatedText: null, isFinal }).catch(() => { });

                    try {
                        const translated = await this.translatorService.translate(
                            text,
                            pipelineConfig.asr.language,
                            pipelineConfig.translation.target
                        );
                        if (translated && translated !== text) {
                            translatedText = translated;
                        }
                    } catch (err) {
                        console.warn("Translation failed:", err);
                    }
                }

                // Apply "Show Original" logic
                let displayText = text;
                if (translatedText && pipelineConfig.translation.showOriginal === false) {
                    displayText = translatedText;
                    translatedText = null;
                }

                sendMessage('RESULT', {
                    text: displayText,
                    translatedText,
                    isFinal
                }).catch(() => { });
            };

            // Send Final chunk first
            if (textToCommit) {
                await sendChunk(textToCommit, true);
            }

            // Send Interim chunk next
            if (interimText) {
                await sendChunk(interimText, false);
            }

        } catch (err) {
            console.error("SlidingWindow Processing Error:", err);
        } finally {
            this.processing = false;
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.processing) return;
        if (this.audioQueue.length === 0) return;

        const item = this.audioQueue.shift();
        if (item.slidingWindow) {
            await this.processSlidingWindowAudio(item.audio);
        } else {
            await this.processAudio(item.audio, item.isFinal);
        }
    }

    /**
     * Queue audio for VAD mode processing.
     */
    async generate(audio, isFinal = true) {
        if (this.audioQueue.length >= this.MAX_QUEUE_SIZE) {
            console.warn("Processing busy, queue full. Dropping request.");
            sendMessage('PERFORMANCE_WARNING', {
                message: 'System overload. Try smaller model.'
            }).catch(() => { });
            return;
        }

        this.audioQueue.push({ audio, isFinal, slidingWindow: false });
        this.processQueue();
    }

    /**
     * Queue audio for sliding window mode processing.
     */
    async generateSlidingWindow(audio) {
        if (this.audioQueue.length >= this.MAX_QUEUE_SIZE) {
            console.warn("Processing busy, queue full. Dropping sliding window request.");
            sendMessage('PERFORMANCE_WARNING', {
                message: 'System overload. Try smaller model.'
            }).catch(() => { });
            return;
        }

        this.audioQueue.push({ audio, slidingWindow: true });
        this.processQueue();
    }

    /**
     * Flush the text stitcher (e.g. on stop recording).
     */
    flushStitcher() {
        if (this.textStitcher) {
            const finalRemaining = this.textStitcher.flush();
            const uncommitted = finalRemaining.slice(this.slidingWindowCommittedLength);
            
            if (uncommitted.trim().length > 0) {
                // Translate the final leftover piece if needed
                let translatedText = null;
                if (pipelineConfig.translation.enabled) {
                    this.translatorService.translate(
                        uncommitted,
                        pipelineConfig.asr.language,
                        pipelineConfig.translation.target
                    ).then(translated => {
                        if (translated && translated !== uncommitted) {
                            translatedText = translated;
                        }
                        let displayText = uncommitted;
                        if (translatedText && pipelineConfig.translation.showOriginal === false) {
                            displayText = translatedText;
                            translatedText = null;
                        }
                        sendMessage('RESULT', { text: displayText, translatedText, isFinal: true }).catch(() => { });
                    }).catch(err => {
                        console.warn("Translation failed for final chunk:", err);
                        sendMessage('RESULT', { text: uncommitted, translatedText: null, isFinal: true }).catch(() => { });
                    });
                } else {
                    sendMessage('RESULT', { text: uncommitted, translatedText: null, isFinal: true }).catch(() => { });
                }
            }

            this.textStitcher.reset();
            this.slidingWindowCommittedLength = 0;
        }
    }

    async downloadModel(settings) {
        let desiredType = settings.asrBackend || 'webgpu';
        const modelId = settings.model_id || '';

        if (modelId.includes('k2')) {
            desiredType = 'k2';
        }

        try {
            const tempService = new ASRWorkerWrapper(desiredType);
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
