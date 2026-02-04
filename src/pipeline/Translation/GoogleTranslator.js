import { BaseTranslator } from "./BaseTranslator.js";

export class GoogleTranslator extends BaseTranslator {
    async translate(text, sourceLang, targetLang) {
        if (!text) return "";
        try {
            const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
            const tl = targetLang || 'zh-TW';

            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Translation API Error: ${response.statusText}`);
            }

            const data = await response.json();
            // data[0] contains array of [translated_text, source_text, ...]
            // We join them just in case multiple sentences are split
            return data[0].map(x => x[0]).join('');
        } catch (e) {
            console.error("Translation failed:", e);
            return text + " [Translation Failed]"; // Fallback to original with indicator, or just original
        }
    }
}

// Register implementations
BaseTranslator.register('google', GoogleTranslator);
