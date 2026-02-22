<script>
    import { Label } from "$lib/components/ui/label/index.js";
    import { Slider } from "$lib/components/ui/slider/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as Card from "$lib/components/ui/card/index.js";

    export let vadSettings = {
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.45,
        minSpeechMs: 100,
        redemptionMs: 50,
    };

    export let onChange = () => {};

    function handleChange() {
        onChange(vadSettings);
    }
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>VAD Parameters (Voice Activity Detection)</Card.Title>
        <Card.Description>
            Fine-tune how the extension detects speech.
        </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-6">
        <!-- Positive Speech Threshold -->
        <div class="grid gap-2">
            <div class="flex justify-between">
                <Label>Positive Speech Threshold</Label>
                <span class="text-sm text-muted-foreground"
                    >{vadSettings.positiveSpeechThreshold.toFixed(2)}</span
                >
            </div>
            <Slider
                value={[vadSettings.positiveSpeechThreshold]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => {
                    vadSettings.positiveSpeechThreshold = v[0];
                    handleChange();
                }}
            />
            <p class="text-xs text-muted-foreground">
                Probability threshold to consider a frame as speech. Higher
                values mean less sensitivity.
            </p>
        </div>

        <!-- Negative Speech Threshold -->
        <div class="grid gap-2">
            <div class="flex justify-between">
                <Label>Negative Speech Threshold</Label>
                <span class="text-sm text-muted-foreground"
                    >{vadSettings.negativeSpeechThreshold.toFixed(2)}</span
                >
            </div>
            <Slider
                value={[vadSettings.negativeSpeechThreshold]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => {
                    vadSettings.negativeSpeechThreshold = v[0];
                    handleChange();
                }}
            />
            <p class="text-xs text-muted-foreground">
                Probability threshold to consider a frame as silence. Lower
                values mean more strict silence detection.
            </p>
        </div>

        <!-- Min Speech Duration -->
        <div class="grid gap-2">
            <Label for="min-speech">Min Speech Duration (ms)</Label>
            <Input
                id="min-speech"
                type="number"
                min="0"
                max="2000"
                bind:value={vadSettings.minSpeechMs}
                onchange={handleChange}
            />
            <p class="text-xs text-muted-foreground">
                Minimum duration of speech to trigger a recording segment.
            </p>
        </div>

        <!-- Redemption Duration -->
        <div class="grid gap-2">
            <Label for="redemption">Redemption Duration (ms)</Label>
            <Input
                id="redemption"
                type="number"
                min="0"
                max="2000"
                bind:value={vadSettings.redemptionMs}
                onchange={handleChange}
            />
            <p class="text-xs text-muted-foreground">
                Wait time after speech ends before stopping recording (to catch
                pauses).
            </p>
        </div>
    </Card.Content>
</Card.Root>
