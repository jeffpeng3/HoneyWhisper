<script lang="ts">
    import { Label } from "$lib/components/ui/label/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { i18n } from "#i18n";

    let {
        profile = $bindable("NORMAL"),
        beamWidth = $bindable(1),
        language = $bindable("ja"),
        onSave = () => {},
    }: {
        profile: string;
        beamWidth: number;
        language: string;
        onSave: () => void;
    } = $props();

    const PROFILES = [
        { value: "TURBO", label: "TURBO (80ms)" },
        { value: "FAST", label: "FAST (160ms)" },
        { value: "BALANCED", label: "BALANCED (320ms)" },
        { value: "NORMAL", label: "NORMAL (560ms)" },
        { value: "HIGH", label: "HIGH (1120ms)" },
    ];

    const BEAM_OPTIONS = [
        { value: "1", label: "1 (greedy)" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
    ];

    const LANGUAGES = [
        { code: "ja", name: "日本語" },
        { code: "en", name: "English" },
        { code: "zh", name: "中文" },
        { code: "es", name: "Español" },
        { code: "fr", name: "Français" },
        { code: "de", name: "Deutsch" },
        { code: "ko", name: "한국어" },
        { code: "auto", name: i18n.t("options.autoDetect") },
    ];
</script>

<div class="space-y-4">
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

    <div class="grid gap-2">
        <Label>{i18n.t("options.sourceLanguage")}</Label>
        <Combobox
            value={language}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
            onSelect={(v: string) => {
                language = v;
                onSave();
            }}
            searchable={true}
            class="w-full"
        />
    </div>
</div>
