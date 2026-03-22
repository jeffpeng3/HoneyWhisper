<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import { Slider } from "$lib/components/ui/slider/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { i18n } from "#i18n";

    import type { VadSettings } from "$lib/types";

    interface SlidingWindowSettings {
        windowSeconds: number;
        stepSeconds: number;
        volumeThreshold: number;
    }

    let {
        audioMode = $bindable("vad"),
        vadSettings = $bindable({
            positiveSpeechThreshold: 0.8,
            negativeSpeechThreshold: 0.45,
            minSpeechMs: 100,
            redemptionMs: 50,
        }),
        slidingWindowSettings = $bindable({
            windowSeconds: 10,
            stepSeconds: 2,
            volumeThreshold: 0.01,
        }),
        onChange = () => {},
    }: {
        audioMode: string;
        vadSettings: VadSettings;
        slidingWindowSettings: SlidingWindowSettings;
        onChange: () => void;
    } = $props();

    let vadEnabled = $derived(audioMode === "vad");

    function handleVadToggle(checked: boolean) {
        audioMode = checked ? "vad" : "sliding_window";
        onChange();
    }
</script>

<div class="space-y-6">
    <!-- VAD Toggle -->
    <Card.Root>
        <Card.Header>
            <Card.Title>{i18n.t("advanced.vadSettings")}</Card.Title>
            <Card.Description>
                {i18n.t("advanced.vadToggleDesc")}
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
            <div class="flex items-center justify-between">
                <Label for="vad-toggle"
                    >{i18n.t("advanced.enableVad")}</Label
                >
                <Switch
                    id="vad-toggle"
                    checked={vadEnabled}
                    onCheckedChange={handleVadToggle}
                />
            </div>

            <!-- VAD Parameters (shown when VAD is enabled) -->
            {#if vadEnabled}
                <!-- Positive Speech Threshold -->
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label
                            >{i18n.t("advanced.positiveThreshold")}</Label
                        >
                        <span class="text-sm text-muted-foreground"
                            >{vadSettings?.positiveSpeechThreshold?.toFixed(
                                2,
                            ) || "0.80"}</span
                        >
                    </div>
                    <Slider
                        type="single"
                        bind:value={vadSettings.positiveSpeechThreshold}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueCommit={() => {
                            onChange();
                        }}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.positiveThresholdDesc")}
                    </p>
                </div>

                <!-- Negative Speech Threshold -->
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label
                            >{i18n.t("advanced.negativeThreshold")}</Label
                        >
                        <span class="text-sm text-muted-foreground"
                            >{vadSettings?.negativeSpeechThreshold?.toFixed(
                                2,
                            ) || "0.45"}</span
                        >
                    </div>
                    <Slider
                        type="single"
                        bind:value={vadSettings.negativeSpeechThreshold}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueCommit={() => {
                            onChange();
                        }}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.negativeThresholdDesc")}
                    </p>
                </div>

                <!-- Min Speech Duration -->
                <div class="grid gap-2">
                    <Label for="min-speech"
                        >{i18n.t("advanced.minSpeech")}</Label
                    >
                    <Input
                        id="min-speech"
                        type="number"
                        min="0"
                        max="2000"
                        bind:value={vadSettings.minSpeechMs}
                        onchange={onChange}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.minSpeechDesc")}
                    </p>
                </div>

                <!-- Redemption Duration -->
                <div class="grid gap-2">
                    <Label for="redemption"
                        >{i18n.t("advanced.redemption")}</Label
                    >
                    <Input
                        id="redemption"
                        type="number"
                        min="0"
                        max="2000"
                        bind:value={vadSettings.redemptionMs}
                        onchange={onChange}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.redemptionDesc")}
                    </p>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <!-- Sliding Window Settings (shown when VAD is disabled) -->
    {#if !vadEnabled}
        <Card.Root>
            <Card.Header>
                <Card.Title
                    >{i18n.t("advanced.slidingWindowSettings")}</Card.Title
                >
            </Card.Header>
            <Card.Content class="space-y-6">
                <!-- Window Seconds -->
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("advanced.windowSeconds")}</Label>
                        <span class="text-sm text-muted-foreground"
                            >{slidingWindowSettings.windowSeconds}s</span
                        >
                    </div>
                    <Slider
                        type="single"
                        bind:value={slidingWindowSettings.windowSeconds}
                        min={5}
                        max={30}
                        step={1}
                        onValueCommit={() => {
                            onChange();
                        }}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.windowSecondsDesc")}
                    </p>
                </div>

                <!-- Step Seconds -->
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("advanced.stepSeconds")}</Label>
                        <span class="text-sm text-muted-foreground"
                            >{slidingWindowSettings.stepSeconds}s</span
                        >
                    </div>
                    <Slider
                        type="single"
                        bind:value={slidingWindowSettings.stepSeconds}
                        min={1}
                        max={10}
                        step={1}
                        onValueCommit={() => {
                            onChange();
                        }}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.stepSecondsDesc")}
                    </p>
                </div>

                <!-- Volume Threshold -->
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("advanced.volumeThreshold")}</Label>
                        <span class="text-sm text-muted-foreground"
                            >{slidingWindowSettings.volumeThreshold.toFixed(3)}</span
                        >
                    </div>
                    <Slider
                        type="single"
                        bind:value={slidingWindowSettings.volumeThreshold}
                        min={0}
                        max={0.1}
                        step={0.001}
                        onValueCommit={() => {
                            onChange();
                        }}
                    />
                    <p class="text-xs text-muted-foreground">
                        {i18n.t("advanced.volumeThresholdDesc")}
                    </p>
                </div>
            </Card.Content>
        </Card.Root>
    {/if}
</div>
