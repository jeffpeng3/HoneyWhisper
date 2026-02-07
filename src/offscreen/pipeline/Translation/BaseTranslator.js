export class BaseTranslator {
    /**
     * Translate text
     * @param {string} text 
     * @param {string} sourceLang 
     * @param {string} targetLang 
     * @returns {Promise<string>}
     */
    async translate(text, sourceLang, targetLang) {
        return text;
    }
}
