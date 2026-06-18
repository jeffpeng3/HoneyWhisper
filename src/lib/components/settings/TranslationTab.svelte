<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { i18n } from "#i18n";
    import { TRANSLATION_LANGUAGES } from "$lib/languages/translation";

    let {
        service = $bindable("none"),
        targetLanguage = $bindable("zh-TW"),
        showOriginal = $bindable(true),
        onSave = () => {},
    }: {
        service: string;
        targetLanguage: string;
        showOriginal: boolean;
        onSave: () => void;
    } = $props();

    const SERVICES = [
        { value: "none", label: i18n.t("options.noTranslation") },
        { value: "google", label: "Google Translate" },
        { value: "deepl", label: "DeepL" },
    ];


</script>

<Card.Root>
    <Card.Header>
        <Card.Title>{i18n.t("options.translationTab")}</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-6">
        <div class="grid gap-2">
            <Label>{i18n.t("options.translationService")}</Label>
            <Combobox
                value={service}
                options={SERVICES.map((s) => ({ value: s.value, label: s.label }))}
                onSelect={(v: string) => {
                    service = v;
                    onSave();
                }}
                class="w-full"
            />
        </div>

        {#if service !== "none"}
            <div class="flex items-center justify-between">
                <Label for="show-original"
                    >{i18n.t("options.showOriginal")}</Label
                >
                <Switch
                    id="show-original"
                    bind:checked={showOriginal}
                    onCheckedChange={onSave}
                />
            </div>

            <div class="grid gap-2">
                <Label>{i18n.t("options.targetLanguage")}</Label>
                <Combobox
                    value={targetLanguage}
                    options={TRANSLATION_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                    onSelect={(v: string) => {
                        targetLanguage = v;
                        onSave();
                    }}
                    searchable={true}
                    class="w-full"
                />
            </div>
        {/if}
    </Card.Content>
</Card.Root>
