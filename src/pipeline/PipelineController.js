import { BaseTranslator } from "../engine/translation/index.js";
import { sendMessage } from "$lib/messaging";
import { pipelineConfig } from "./PipelineConfig.ts";
import { Segmenter } from "./Segmenter.js";
import { createASR } from "../engine/asr/index.js";

const NORM_TARGET = 0.85;

export class PipelineController {
    constructor() {
        this.asr = null;
        this.session = null;
        this.translator = null;
        this.segmenter = null;
        this.normPeak = 0;
        this.smoothGain = 1;
    }

    _normalize(samples) {
        let bufPeak = 0;
        for (let i = 0; i < samples.length; i++) {
            const a = Math.abs(samples[i]);
            if (a > bufPeak) bufPeak = a;
        }

        if (bufPeak > this.normPeak) {
            this.normPeak += (bufPeak - this.normPeak) * 0.5;
        } else {
            this.normPeak += (bufPeak - this.normPeak) * 0.0005;
        }

        const targetGain = this.normPeak > 1e-4
            ? Math.min(NORM_TARGET / this.normPeak, 20)
            : 1;

        if (targetGain > this.smoothGain) {
            this.smoothGain += (targetGain - this.smoothGain) * 0.08;
        } else {
            this.smoothGain += (targetGain - this.smoothGain) * 0.5;
        }

        if (Math.abs(this.smoothGain - 1) > 0.01) {
            for (let i = 0; i < samples.length; i++) samples[i] *= this.smoothGain;
        }
        return samples;
    }

    get modelReady() {
        return this.asr?.ready ?? false;
    }

    async preload() {
        this.asr = createASR('nemotron');
        this.segmenter = new Segmenter({ timeoutMs: 500 });
        this.segmenter.onTimeout = (text) => this._emitFinal(text);

        const progressCb = (label, loaded, total, cached) => {
            sendMessage('DOWNLOAD_PROGRESS', {
                progress: total > 0 ? (loaded / total) * 100 : 0,
                file: label,
                status: loaded === total ? 'done' : 'progress',
                cached: !!cached,
            }).catch(() => {});
        };

        await this.asr.preload(progressCb);

        sendMessage('MODEL_READY', undefined).catch(() => {});
    }

    async startStreaming(langId) {
        const partialCb = (text, lang, progress) => {
            console.log('[ASR partial]', text, lang, progress);
        };

        const vad = pipelineConfig.asr.vad;
        await this.asr.init({
            profile: pipelineConfig.asr.profile,
            beamWidth: pipelineConfig.asr.beamWidth,
            vad: vad.enabled ? {
                threshold: vad.threshold,
                minSpeech: vad.minSpeech,
                minSilence: vad.minSilence,
                hold: vad.hold,
            } : false,
            callbacks: { partial: partialCb },
        });

        this.session = this.asr.createSession(
            this.asr.constructor.fromSharedCode(langId || pipelineConfig.asr.language),
            vad.enabled ? {
                threshold: vad.threshold,
                minSpeech: vad.minSpeech,
                minSilence: vad.minSilence,
                hold: vad.hold,
            } : false,
        );
    }

    async feedAudio(chunk) {
        if (!this.session) return;

        this._normalize(chunk);

        const results = await this.session.feed(chunk);

        if (results && results.length) {
            for (const result of results) {
                if (!result.text) continue;
                const sentences = this.segmenter.feed(result.text);
                for (const sentence of sentences) {
                    await this._emitFinal(sentence);
                }
            }
            const partial = this.segmenter.partial;
            if (partial) {
                await this._emitPartial(partial);
            }
        }
    }

    async stop() {
        const final = await this.session?.end();
        if (final?.text) {
            this.segmenter.feed(final.text);
        }
        const remaining = this.segmenter.flush();
        if (remaining) {
            await this._emitFinal(remaining);
        }
        await this.asr.release();
        this.segmenter?.destroy();
        this.session = null;
        this.asr = null;
        this.lastAsrText = '';
        this.normPeak = 0;
        this.smoothGain = 1;
    }

    async _emitFinal(text) {
        const translated = await this._translate(text);
        let displayText = text;
        let translatedText = null;
        if (translated && pipelineConfig.translation.showOriginal === false) {
            displayText = translated;
        } else if (translated) {
            translatedText = translated;
        }
        sendMessage('RESULT', { text: displayText, translatedText, isFinal: true }).catch(() => {});
    }

    async _emitPartial(text) {
        const translated = this.translator?.supportsPreview
            ? await this._translate(text)
            : null;
        let displayText = text;
        let translatedText = null;
        if (translated && pipelineConfig.translation.showOriginal === false) {
            displayText = translated;
        } else if (translated) {
            translatedText = translated;
        }
        sendMessage('RESULT', { text: displayText, translatedText, isFinal: false }).catch(() => {});
    }

    syncTranslator() {
        const service = pipelineConfig.translation.service;
        this.translator = service !== 'none' ? BaseTranslator.create(service) : null;
    }

    async _translate(text) {
        if (!this.translator || !text) return null;
        try {
            return await this.translator.translate(text, pipelineConfig.asr.language, pipelineConfig.translation.target);
        } catch (err) {
            console.warn('Translation failed:', err);
            return null;
        }
    }
}

export const pipelineController = new PipelineController();
