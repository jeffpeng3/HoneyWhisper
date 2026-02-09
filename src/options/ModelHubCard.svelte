<script>
    import * as Card from "$lib/components/ui/card/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";

    let { model, onCreate } = $props();
</script>

<Card.Root class="h-full flex flex-col">
    <Card.Header>
        <Card.Title class="text-lg">{model.name}</Card.Title>
    </Card.Header>
    <Card.Content class="flex-1">
        <p class="text-sm text-muted-foreground break-all mb-4">{model.id}</p>
        {#if model.tags}
            <div class="flex flex-wrap gap-1">
                {#each model.tags as tag}
                    <Badge variant="outline">{tag}</Badge>
                {/each}
            </div>
        {/if}
    </Card.Content>
    <Card.Footer class="flex justify-end gap-2 pt-4">
        <Button
            variant="outline"
            size="sm"
            href={model.homepage || `https://huggingface.co/${model.id}`}
            target="_blank"
        >
            View on HF
        </Button>
        <Button size="sm" onclick={onCreate}>Create Profile</Button>
    </Card.Footer>
</Card.Root>
