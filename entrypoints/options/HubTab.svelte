<script>
    import ModelHubCard from "./ModelHubCard.svelte";
    import { i18n } from "#i18n";

    let {
        hubModels = [],
        hubLoading = false,
        onCreateProfile = () => {},
    } = $props();
</script>

<div class="space-y-4">
    <h2 class="text-xl font-semibold">{i18n.t("hub.title")}</h2>
    {#if hubLoading}
        <div class="flex items-center justify-center p-8">
            <p class="text-muted-foreground">{i18n.t("hub.loading")}</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each hubModels as model}
                {#if model.type !== "remote"}
                    <ModelHubCard
                        {model}
                        onCreate={() => onCreateProfile(model)}
                    />
                {/if}
            {/each}
        </div>
    {/if}
</div>
