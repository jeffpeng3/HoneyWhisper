<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import * as Card from "$lib/components/ui/card/index.js";
    import NemotronSettings from "./NemotronSettings.svelte";
    import GeminiSettings from "./GeminiSettings.svelte";
    import { i18n } from "#i18n";

    let {
        asrBackend = $bindable("nemotron"),
        nemotronLanguage = $bindable("ja"),
        nemotronProfile = $bindable("NORMAL"),
        beamWidth = $bindable(1),
        vadEnabled = $bindable(false),
        vadThreshold = $bindable(0.01),
        vadMinSpeech = $bindable(0.25),
        vadMinSilence = $bindable(0.4),
        vadHold = $bindable(0.15),
        geminiLanguage = $bindable("auto"),
        geminiApiKey = $bindable(""),
        onSave = () => {},
    }: {
        asrBackend: string;
        nemotronLanguage: string;
        nemotronProfile: string;
        beamWidth: number;
        vadEnabled: boolean;
        vadThreshold: number;
        vadMinSpeech: number;
        vadMinSilence: number;
        vadHold: number;
        geminiLanguage: string;
        geminiApiKey: string;
        onSave: () => void;
    } = $props();

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
                value={asrBackend}
                options={BACKENDS.map((b) => ({ value: b.value, label: b.label }))}
                onSelect={(v: string) => {
                    asrBackend = v;
                    onSave();
                }}
                class="w-full"
            />
        </div>

        <div class="border rounded-lg p-4">
            {#if asrBackend === "nemotron"}
                <NemotronSettings
                    bind:profile={nemotronProfile}
                    bind:beamWidth
                    bind:language={nemotronLanguage}
                    bind:vadEnabled
                    bind:vadThreshold
                    bind:vadMinSpeech
                    bind:vadMinSilence
                    bind:vadHold
                    {onSave}
                />
            {:else if asrBackend === "gemini"}
                <GeminiSettings
                    bind:apiKey={geminiApiKey}
                    bind:language={geminiLanguage}
                    {onSave}
                />
            {:else}
                <p class="text-sm text-muted-foreground">
                    {i18n.t("options.noSettingsForBackend")}
                </p>
            {/if}
        </div>
    </Card.Content>
</Card.Root>
