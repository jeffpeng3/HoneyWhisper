import { BaseTranslator } from "./BaseTranslator.js";

export class BuiltinTranslator extends BaseTranslator {
    get supportsPreview() {
        return true;
    }

    async translate(text, sourceLang, targetLang, preTranslated = null) {
        return preTranslated ?? text;
    }
}

BaseTranslator.register('builtin', BuiltinTranslator);
