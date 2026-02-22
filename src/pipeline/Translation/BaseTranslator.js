export class BaseTranslator {
    static registry = new Map();

    static register(name, cls) {
        BaseTranslator.registry.set(name, cls);
    }

    static get(name) {
        return BaseTranslator.registry.get(name);
    }

    static create(name, ...args) {
        const cls = BaseTranslator.get(name);
        if (!cls) {
            throw new Error(`Translator Service '${name}' not found`);
        }
        return new cls(...args);
    }

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
