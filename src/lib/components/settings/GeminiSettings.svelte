<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { i18n } from "#i18n";
    import { getAsrLanguages } from "$lib/languages/asr";
    import { asrConfig, secretsConfig } from "$lib/settings/index.ts";

    let { _rev = 0 }: { _rev?: number } = $props();

    const LANGUAGES = getAsrLanguages("gemini");
</script>

<div class="space-y-4">
    <div class="grid gap-2">
        <Label for="gemini-api-key">API Key</Label>
        <input
            id="gemini-api-key"
            type="password"
            bind:value={secretsConfig.geminiApiKey}
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your Gemini API key"
        />
    </div>

    <div class="grid gap-2">
        <Label>{i18n.t("options.sourceLanguage")}</Label>
        <Combobox
            value={asrConfig.gemini.language}
            options={LANGUAGES}
            onSelect={(v: string) => { asrConfig.gemini.language = v; }}
            searchable={true}
            class="w-full"
        />
    </div>
</div>
