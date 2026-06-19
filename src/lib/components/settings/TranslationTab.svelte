<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { i18n } from "#i18n";
    import { TRANSLATION_LANGUAGES } from "$lib/languages/translation";
    import { asrConfig, translationConfig } from "$lib/settings/index.ts";
    import { createASR } from "@/engine/asr/index.js";

    let _rev = $state(0);
    $effect(() => {
        const unsub = translationConfig.onChange(() => _rev++);
        return unsub;
    });

    let SERVICES = $state([
        { value: "none", label: i18n.t("options.noTranslation") },
        { value: "google", label: "Google Translate" },
        { value: "deepl", label: "DeepL" },
    ]);

    $effect(() => {
        _rev; // trigger re-run when store changes
        try {
            const asr = createASR(asrConfig.engine);
            if (asr.providesTranslation) {
                SERVICES = [
                    { value: "none", label: i18n.t("options.noTranslation") },
                    { value: "builtin", label: "Built-in (Gemini)" },
                    { value: "google", label: "Google Translate" },
                    { value: "deepl", label: "DeepL" },
                ];
            } else {
                SERVICES = [
                    { value: "none", label: i18n.t("options.noTranslation") },
                    { value: "google", label: "Google Translate" },
                    { value: "deepl", label: "DeepL" },
                ];
            }
        } catch {
            SERVICES = [
                { value: "none", label: i18n.t("options.noTranslation") },
                { value: "google", label: "Google Translate" },
                { value: "deepl", label: "DeepL" },
            ];
        }
    });
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>{i18n.t("options.translationTab")}</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-6">
        <div class="grid gap-2">
            <Label>{i18n.t("options.translationService")}</Label>
            <Combobox
                value={translationConfig.service}
                options={(_rev, SERVICES.map((s) => ({ value: s.value, label: s.label })))}
                onSelect={(v: string) => { translationConfig.service = v; }}
                class="w-full"
            />
        </div>

        {#if _rev !== undefined && translationConfig.service !== "none"}
            <div class="flex items-center justify-between">
                <Label for="show-original"
                    >{i18n.t("options.showOriginal")}</Label
                >
                <Switch
                    id="show-original"
                    checked={translationConfig.showOriginal}
                    onCheckedChange={(v: boolean) => { translationConfig.showOriginal = v; }}
                />
            </div>

            <div class="grid gap-2">
                <Label>{i18n.t("options.targetLanguage")}</Label>
                <Combobox
                    value={translationConfig.target}
                    options={(_rev, TRANSLATION_LANGUAGES.map((l) => ({ value: l.value, label: l.label })))}
                    onSelect={(v: string) => { translationConfig.target = v; }}
                    searchable={true}
                    class="w-full"
                />
            </div>
        {/if}
    </Card.Content>
</Card.Root>
