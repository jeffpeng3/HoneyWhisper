<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Slider } from "$lib/components/ui/slider/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { i18n } from "#i18n";
    import { getNemotronLanguages } from "$lib/nemotron-languages";
    import { sendMessage, onMessage } from "$lib/messaging";
    import { onDestroy } from "svelte";

    let {
        profile = $bindable("NORMAL"),
        beamWidth = $bindable(1),
        language = $bindable("ja"),
        vadEnabled = $bindable(false),
        vadThreshold = $bindable(0.01),
        vadMinSpeech = $bindable(0.25),
        vadMinSilence = $bindable(0.4),
        vadHold = $bindable(0.15),
        onSave = () => {},
    }: {
        profile: string;
        beamWidth: number;
        language: string;
        vadEnabled: boolean;
        vadThreshold: number;
        vadMinSpeech: number;
        vadMinSilence: number;
        vadHold: number;
        onSave: () => void;
    } = $props();

    const PROFILES = [
        { value: "TURBO", label: "80ms" },
        { value: "FAST", label: "160ms" },
        { value: "BALANCED", label: "320ms" },
        { value: "NORMAL", label: "560ms" },
        { value: "HIGH", label: "1120ms" },
    ];

    const BEAM_OPTIONS = [
        { value: "1", label: `1 (${i18n.t("options.beamFast")})` },
        { value: "2", label: `2` },
        { value: "3", label: `3 (${i18n.t("options.beamSlow")})` },
    ];

    const LANGUAGES = getNemotronLanguages();

    const ALL_PROFILES = ["HIGH", "NORMAL", "BALANCED", "FAST", "TURBO"];
    const BEAM_DISPLAY = ["1", "2", "3"];

    let benchmarking = $state(false);
    let benchmarkResults = $state<Map<string, Map<number, number>> | null>(null);
    let benchmarkProgress = $state("");

    function addPartialResults(rows: Array<{ profile: string; beamWidth: number; rtf: number }>) {
        const map = new Map(benchmarkResults ?? new Map());
        for (const r of rows) {
            if (!map.has(r.profile)) map.set(r.profile, new Map());
            map.get(r.profile)!.set(r.beamWidth, r.rtf);
        }
        benchmarkResults = map;
    }

    const unsubBenchmark = onMessage('BENCHMARK_RESULT', (msg) => {
        addPartialResults(msg.data);
    });
    onDestroy(unsubBenchmark);

    async function runBenchmark() {
        benchmarking = true;
        benchmarkResults = null;
        benchmarkProgress = i18n.t("benchmark.initializing");
        try {
            await sendMessage("INIT_MODEL", undefined);
            for (let i = 0; i < 180; i++) {
                const state: any = await sendMessage("GET_STATE", undefined);
                if (state.modelReady) break;
                await new Promise(r => setTimeout(r, 200));
            }
            const results: Array<{ profile: string; beamWidth: number; rtf: number }> = await sendMessage("BENCHMARK_ASR", { beamWidths: [1, 2, 3] });
            addPartialResults(results);
            benchmarkProgress = "";
        } catch (err: any) {
            benchmarkProgress = i18n.t("benchmark.errorPrefix") + (err.message || err);
        } finally {
            benchmarking = false;
            sendMessage("CLOSE_OFFSCREEN", undefined).catch(() => {});
        }
    }
</script>

<div class="space-y-4">
    <div class="grid gap-2">
        <Label>{i18n.t("options.sourceLanguage")}</Label>
        <Combobox
            value={language}
            options={LANGUAGES}
            onSelect={(v: string) => {
                language = v;
                onSave();
            }}
            searchable={true}
            class="w-full"
        />
    </div>

    <div class="grid gap-2">
        <Label>{i18n.t("options.profile")}</Label>
        <Combobox
            value={profile}
            options={PROFILES.map((p) => ({ value: p.value, label: p.label }))}
            onSelect={(v: string) => {
                profile = v;
                onSave();
            }}
            class="w-full"
        />
    </div>

    <div class="grid gap-2">
        <Label>{i18n.t("options.beamWidth")}</Label>
        <Combobox
            value={String(beamWidth)}
            options={BEAM_OPTIONS.map((b) => ({ value: b.value, label: b.label }))}
            onSelect={(v: string) => {
                beamWidth = parseInt(v);
                onSave();
            }}
            class="w-full"
        />
    </div>

    <div class="border-t pt-4 space-y-4">
        <div class="flex items-center justify-between">
            <Label>{i18n.t("options.vad")}</Label>
            <Switch
                bind:checked={vadEnabled}
                onCheckedChange={onSave}
            />
        </div>

        {#if vadEnabled}
            <div class="ml-4 space-y-4">
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("options.vadThreshold")}</Label>
                        <span class="text-sm text-muted-foreground">{vadThreshold.toFixed(3)}</span>
                    </div>
                    <Slider
                        type="single"
                        min={0.001}
                        max={0.05}
                        step={0.001}
                        value={[vadThreshold]}
                        onValueChange={(v: number[]) => { vadThreshold = v[0]; }}
                        onValueCommit={onSave}
                    />
                </div>
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("options.vadMinSpeech")}</Label>
                        <span class="text-sm text-muted-foreground">{vadMinSpeech.toFixed(2)}s</span>
                    </div>
                    <Slider
                        type="single"
                        min={0.05}
                        max={1.0}
                        step={0.05}
                        value={[vadMinSpeech]}
                        onValueChange={(v: number[]) => { vadMinSpeech = v[0]; }}
                        onValueCommit={onSave}
                    />
                </div>
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("options.vadMinSilence")}</Label>
                        <span class="text-sm text-muted-foreground">{vadMinSilence.toFixed(2)}s</span>
                    </div>
                    <Slider
                        type="single"
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        value={[vadMinSilence]}
                        onValueChange={(v: number[]) => { vadMinSilence = v[0]; }}
                        onValueCommit={onSave}
                    />
                </div>
                <div class="grid gap-2">
                    <div class="flex justify-between">
                        <Label>{i18n.t("options.vadHold")}</Label>
                        <span class="text-sm text-muted-foreground">{vadHold.toFixed(2)}s</span>
                    </div>
                    <Slider
                        type="single"
                        min={0.0}
                        max={0.5}
                        step={0.05}
                        value={[vadHold]}
                        onValueChange={(v: number[]) => { vadHold = v[0]; }}
                        onValueCommit={onSave}
                    />
                </div>
            </div>
        {/if}
    </div>

    <div class="border-t pt-4 space-y-4">
        <div class="flex items-center justify-between">
            <div>
                <Label>{i18n.t("benchmark.title")}</Label>
                <p class="text-xs text-muted-foreground mt-0.5">{i18n.t("benchmark.desc")}</p>
            </div>
            <Button variant="outline" size="sm" onclick={runBenchmark} disabled={benchmarking}>
                {benchmarking ? i18n.t("benchmark.running") : i18n.t("benchmark.run")}
            </Button>
        </div>

        {#if benchmarkProgress}
            <p class="text-sm text-muted-foreground">{benchmarkProgress}</p>
        {/if}

        {#if benchmarkResults}
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left py-1 pr-2 font-medium">{i18n.t("benchmark.profileLabel")}</th>
                            {#each BEAM_DISPLAY as bw}
                                <th class="text-center px-1 py-1 font-medium">{i18n.t("benchmark.beam", [bw])}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each ALL_PROFILES as profile}
                            <tr class="border-b border-muted">
                                <td class="py-1 pr-2 text-muted-foreground text-xs">{profile === "HIGH" ? "1120ms" : profile === "NORMAL" ? "560ms" : profile === "BALANCED" ? "320ms" : profile === "FAST" ? "160ms" : "80ms"}</td>
                                {#each BEAM_DISPLAY as bw}
                                    {@const rtf = benchmarkResults.get(profile)?.get(parseInt(bw))}
                                    <td class="text-center px-1 py-1">
                                        {#if rtf !== undefined}
                                            <span class="font-mono" class:text-green-600={rtf <= 1.1} class:text-destructive={rtf > 1.1}>
                                                {(1 / rtf).toFixed(1)}x
                                            </span>
                                        {:else}
                                            <span class="text-destructive font-mono">—</span>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-muted-foreground">
                {i18n.t("benchmark.note")}
            </p>
        {/if}
    </div>
</div>
