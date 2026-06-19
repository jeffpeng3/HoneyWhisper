<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import * as Card from "$lib/components/ui/card/index.js";
    import NemotronSettings from "./NemotronSettings.svelte";
    import GeminiSettings from "./GeminiSettings.svelte";
    import { i18n } from "#i18n";
    import { asrConfig } from "$lib/settings/index.ts";

    let _rev = $state(0);
    $effect(() => {
        const unsub = asrConfig.onChange(() => _rev++);
        return unsub;
    });

    const BACKENDS = [
        { value: "nemotron", label: "Nemotron 3.5 (local)" },
        { value: "gemini", label: "Gemini 3.5 Live Translate" },
    ];
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>{i18n.t("options.asrTab")}</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-6">
        <div class="grid gap-2">
            <Label>{i18n.t("options.asrBackend")}</Label>
            <Combobox
                value={asrConfig.engine}
                options={(_rev, BACKENDS.map((b) => ({ value: b.value, label: b.label })))}
                onSelect={(v: string) => { asrConfig.engine = v; }}
                class="w-full"
            />
        </div>

        <div class="border rounded-lg p-4">
            {#if asrConfig.engine === "nemotron"}
                <NemotronSettings {_rev} />
            {:else if asrConfig.engine === "gemini"}
                <GeminiSettings {_rev} />
            {:else}
                <p class="text-sm text-muted-foreground">
                    {i18n.t("options.noSettingsForBackend")}
                </p>
            {/if}
        </div>
    </Card.Content>
</Card.Root>
