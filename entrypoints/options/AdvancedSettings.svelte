<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import { Slider } from "$lib/components/ui/slider/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { i18n } from "#i18n";

    import type { VadSettings } from "$lib/types";

    let {
        vadSettings = $bindable({
            positiveSpeechThreshold: 0.8,
            negativeSpeechThreshold: 0.45,
            minSpeechMs: 100,
            redemptionMs: 50,
        }),
        onChange = (settings: VadSettings) => {},
    }: {
        vadSettings: VadSettings;
        onChange: (settings: VadSettings) => void;
    } = $props();

    $effect(() => {
        onChange(vadSettings);
    });
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>{i18n.t("advanced.vadSettings")}</Card.Title>
        <Card.Description>
            {i18n.t("advanced.vadDesc")}
        </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-6">
        <!-- Positive Speech Threshold -->
        <div class="grid gap-2">
            <div class="flex justify-between">
                <Label>{i18n.t("advanced.positiveThreshold")}</Label>
                <span class="text-sm text-muted-foreground"
                    >{vadSettings?.positiveSpeechThreshold?.toFixed(2) ||
                        "0.80"}</span
                >
            </div>
            <Slider
                type="single"
                value={[vadSettings.positiveSpeechThreshold]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v: number[]) => {
                    if (v && v.length > 0)
                        vadSettings.positiveSpeechThreshold = v[0];
                }}
            />
            <p class="text-xs text-muted-foreground">
                {i18n.t("advanced.positiveThresholdDesc")}
            </p>
        </div>

        <!-- Negative Speech Threshold -->
        <div class="grid gap-2">
            <div class="flex justify-between">
                <Label>{i18n.t("advanced.negativeThreshold")}</Label>
                <span class="text-sm text-muted-foreground"
                    >{vadSettings?.negativeSpeechThreshold?.toFixed(2) ||
                        "0.45"}</span
                >
            </div>
            <Slider
                type="single"
                value={[vadSettings.negativeSpeechThreshold]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v: number[]) => {
                    if (v && v.length > 0)
                        vadSettings.negativeSpeechThreshold = v[0];
                }}
            />
            <p class="text-xs text-muted-foreground">
                {i18n.t("advanced.negativeThresholdDesc")}
            </p>
        </div>

        <!-- Min Speech Duration -->
        <div class="grid gap-2">
            <Label for="min-speech">{i18n.t("advanced.minSpeech")}</Label>
            <Input
                id="min-speech"
                type="number"
                min="0"
                max="2000"
                bind:value={vadSettings.minSpeechMs}
            />
            <p class="text-xs text-muted-foreground">
                {i18n.t("advanced.minSpeechDesc")}
            </p>
        </div>

        <!-- Redemption Duration -->
        <div class="grid gap-2">
            <Label for="redemption">{i18n.t("advanced.redemption")}</Label>
            <Input
                id="redemption"
                type="number"
                min="0"
                max="2000"
                bind:value={vadSettings.redemptionMs}
            />
            <p class="text-xs text-muted-foreground">
                {i18n.t("advanced.redemptionDesc")}
            </p>
        </div>
    </Card.Content>
</Card.Root>
