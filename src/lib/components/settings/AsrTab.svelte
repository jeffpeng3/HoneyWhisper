<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import * as Card from "$lib/components/ui/card/index.js";
    import NemotronSettings from "./NemotronSettings.svelte";
    import { i18n } from "#i18n";

    let {
        asrBackend = $bindable("nemotron"),
        language = $bindable("ja"),
        nemotronProfile = $bindable("NORMAL"),
        beamWidth = $bindable(1),
        onSave = () => {},
    }: {
        asrBackend: string;
        language: string;
        nemotronProfile: string;
        beamWidth: number;
        onSave: () => void;
    } = $props();

    const BACKENDS = [
        { value: "nemotron", label: "Nemotron 3.5 (local)" },
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
                    bind:language
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
