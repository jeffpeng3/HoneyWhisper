import { BaseASR } from './BaseASR.js';

export class GeminiSession {
    constructor(ws) {
        this.ws = ws;
        this._buffer = '';
    }

    async feed(chunk) {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(chunk.buffer)));
        const msg = {
            realtimeInput: {
                mediaChunks: [{ data: base64, mimeType: 'audio/pcm' }],
            },
        };
        this.ws.send(JSON.stringify(msg));
        return [];
    }

    async end() {
        this.ws.close();
        return null;
    }
}

export class GeminiASR extends BaseASR {
    static async preload(onProgress) {
    }

    constructor() {
        super();
        this.apiKey = '';
        this._currentLang = null;
    }

    get detectedLanguage() {
        return this._currentLang ?? 'auto';
    }

    get providesTranslation() {
        return true;
    }

    get ready() {
        return !!this.apiKey;
    }

    async init({ apiKey = '', language = 'auto' } = {}) {
        this.apiKey = apiKey;
        this._currentLang = language;
    }

    createSession(lang, vad) {
        this._currentLang = lang;
        const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`);
        ws.onopen = () => {
            const setup = {
                setup: {
                    model: 'models/gemini-3.5-live-translate-preview',
                    systemInstruction: null,
                    generationConfig: {
                        responseModalities: ['TEXT'],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: '' } },
                        },
                    },
                },
            };
            ws.send(JSON.stringify(setup));
        };
        return new GeminiSession(ws);
    }

    async release() {
        this.apiKey = '';
    }

    async clearCache() {
    }
}
