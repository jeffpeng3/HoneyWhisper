<script>
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Slider } from "$lib/components/ui/slider/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { i18n } from "#i18n";
    import { browser } from "wxt/browser";

    let {
        translationEnabled = $bindable(false),
        showOriginal = $bindable(true),
        translationService = $bindable("google"),
        targetLanguage = $bindable("zh-TW"),
        language = $bindable("ja"),
        fontSize = $bindable(24),
        historyLines = $bindable(1),
        installedModels = [],
        updateStatus = "idle",
        updateData = null,
        onSave = () => {},
        onCheckUpdate = () => {},
        onClearCache = () => {},
        onListModels = () => {},
        onResetAll = () => {},
    } = $props();

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

    const TARGET_LANGUAGES = [
        { code: "zh-TW", name: "繁體中文" },
        { code: "zh-CN", name: "简体中文" },
        { code: "en", name: "English" },
        { code: "ja", name: "日本語" },
        { code: "ko", name: "한국어" },
        { code: "es", name: "Español" },
        { code: "fr", name: "Français" },
        { code: "de", name: "Deutsch" },
    ];

    const TRANSLATION_SERVICES = [
        { id: "google", name: "Google Translate" },
        { id: "deepl", name: "DeepL" },
    ];
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>{i18n.t("options.title")}</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-6">
        <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.translation")}</h3>
            <div class="flex items-center justify-between">
                <Label for="translation-mode"
                    >{i18n.t("options.enableTranslation")}</Label
                >
                <Switch
                    id="translation-mode"
                    bind:checked={translationEnabled}
                    onCheckedChange={onSave}
                />
            </div>
            {#if translationEnabled}
                <div class="flex items-center justify-between ml-4">
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
                    <Label>{i18n.t("options.translationService")}</Label>
                    <Combobox
                        value={translationService}
                        options={TRANSLATION_SERVICES.map((s) => ({
                            value: s.id,
                            label: s.name,
                        }))}
                        onSelect={(v) => {
                            translationService = v;
                            onSave();
                        }}
                        class="w-full"
                    />
                </div>

                <div class="grid gap-2">
                    <Label>{i18n.t("options.targetLanguage")}</Label>
                    <Combobox
                        value={targetLanguage}
                        options={TARGET_LANGUAGES.map((l) => ({
                            value: l.code,
                            label: l.name,
                        }))}
                        onSelect={(v) => {
                            targetLanguage = v;
                            onSave();
                        }}
                        searchable={true}
                        class="w-full"
                    />
                </div>
            {/if}
        </div>

        <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.language")}</h3>
            <div class="grid gap-2">
                <Label>{i18n.t("options.sourceLanguage")}</Label>
                <Combobox
                    value={language}
                    options={LANGUAGES.map((l) => ({
                        value: l.code,
                        label: l.name,
                    }))}
                    onSelect={(v) => {
                        language = v;
                        onSave();
                    }}
                    searchable={true}
                    class="w-full"
                />
            </div>
        </div>

        <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("options.displayTab")}</h3>
            <div class="grid gap-2">
                <div class="flex justify-between">
                    <Label>{i18n.t("options.fontSize")}</Label>
                    <span class="text-sm text-muted-foreground"
                        >{fontSize}px</span
                    >
                </div>
                <Slider
                    value={[fontSize]}
                    min={16}
                    max={48}
                    step={1}
                    onValueChange={(v) => {
                        fontSize = v[0];
                        onSave();
                    }}
                />
            </div>
            <div class="grid gap-2">
                <Label for="history-lines"
                    >{i18n.t("options.historyLines")}</Label
                >
                <Input
                    id="history-lines"
                    type="number"
                    min="0"
                    max="5"
                    bind:value={historyLines}
                    onchange={onSave}
                />
            </div>
        </div>

        <div class="space-y-4">
            <h3 class="text-lg font-medium">{i18n.t("update.title")}</h3>
            <div class="flex items-center justify-between">
                <div class="flex flex-col">
                    <Label>{i18n.t("update.checkUpdate")}</Label>
                    <span class="text-xs text-muted-foreground"
                        >{i18n.t("update.currentVersion")}
                        {browser.runtime.getManifest().version}</span
                    >
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onclick={onCheckUpdate}
                    disabled={updateStatus === "checking"}
                >
                    {updateStatus === "checking"
                        ? i18n.t("update.checking")
                        : i18n.t("update.check")}
                </Button>
            </div>
            {#if updateStatus === "available"}
                <div
                    class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-900"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p
                                class="font-medium text-yellow-800 dark:text-yellow-200"
                            >
                                {i18n.t("update.available")}
                                {updateData?.latestVersion || ""}
                            </p>
                            <a
                                href={updateData?.releaseUrl || "#"}
                                target="_blank"
                                class="text-sm underline text-yellow-700 dark:text-yellow-300"
                                >{i18n.t("update.viewRelease")}</a
                            >
                        </div>
                    </div>
                </div>
            {:else if updateStatus === "uptodate"}
                <div class="text-sm text-green-600 dark:text-green-400">
                    {i18n.t("update.isLatest")}
                </div>
            {:else if updateStatus === "error"}
                <div class="text-sm text-destructive">
                    {i18n.t("update.checkFailed")}
                </div>
            {/if}
        </div>

        <div class="space-y-4 border-t pt-4">
            <h3 class="text-lg font-medium text-destructive">
                {i18n.t("advanced.debug")}
            </h3>
            <div class="flex gap-2 flex-wrap text-xs">
                <Button variant="secondary" size="sm" onclick={onClearCache}
                    >{i18n.t("advanced.clearCache")}</Button
                >
                <Button variant="outline" size="sm" onclick={onListModels}
                    >{i18n.t("advanced.checkCache")}</Button
                >
                <Button variant="destructive" size="sm" onclick={onResetAll}
                    >{i18n.t("advanced.resetAll")}</Button
                >
            </div>
            <div class="text-xs text-muted-foreground">
                {i18n.t("advanced.debugDesc")}
            </div>
            {#if installedModels.length > 0}
                <div
                    class="bg-muted p-2 rounded text-sm font-mono overflow-auto max-h-[100px]"
                >
                    <ul>
                        {#each installedModels as m}<li>{m}</li>{/each}
                    </ul>
                </div>
            {/if}
        </div>
    </Card.Content>
</Card.Root>
