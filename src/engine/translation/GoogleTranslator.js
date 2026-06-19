import { BaseTranslator } from "./BaseTranslator.js";

export class GoogleTranslator extends BaseTranslator {
    constructor() {
        super();
        this.maxRetries = 3;
        this.baseDelay = 100;
    }

    async translate(text, sourceLang, targetLang, preTranslated = null) {
        if (!text) return "";

        const sl = this.constructor.toEngineCode(sourceLang);
        const tl = this.constructor.toEngineCode(targetLang || 'zh-TW');
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    const isRetryable = response.status === 429 || response.status >= 500;
                    if (!isRetryable || attempt === this.maxRetries) {
                        throw new Error(`Translation API Error: ${response.status} ${response.statusText}`);
                    }
                    // Fall through to retry after delay
                    lastError = new Error(`Translation API Error: ${response.status} ${response.statusText}`);
                } else {
                    const data = await response.json();
                    return data[0].map(x => x[0]).join('');
                }
            } catch (e) {
                lastError = e;
                if (attempt === this.maxRetries) break;
            }

            // Exponential backoff: 500ms, 1000ms, 2000ms
            const delay = this.baseDelay * Math.pow(2, attempt);
            console.warn(`Google Translate retry ${attempt + 1}/${this.maxRetries} after ${delay}ms:`, lastError?.message);
            await new Promise(r => setTimeout(r, delay));
        }

        console.error("Translation failed after retries:", lastError);
        return text + " [Translation Failed]";
    }
}

BaseTranslator.register('google', GoogleTranslator);
