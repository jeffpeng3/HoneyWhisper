<script>
    import Check from "lucide-svelte/icons/check";
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
    import * as Command from "$lib/components/ui/command/index.js";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
    import { cn } from "$lib/utils.js";
    import { tick } from "svelte";

    let {
        value = $bindable(""),
        options = [],
        placeholder = "Select...",
        emptyText = "No results found.",
        class: className,
        onSelect,
        searchable = false,
        ...restProps
    } = $props();

    let open = $state(false);
    let triggerRef = $state(null);

    function closeAndFocusTrigger() {
        open = false;
        tick().then(() => {
            triggerRef?.focus();
        });
    }
</script>

<Popover.Root bind:open>
    <Popover.Trigger
        bind:ref={triggerRef}
        class={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between",
            className,
        )}
        role="combobox"
        aria-expanded={open}
        {...restProps}
    >
        {options.find((f) => f.value === value)?.label ?? placeholder}
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Popover.Trigger>
    <Popover.Content class="w-[--bits-popover-anchor-width] p-0">
        <Command.Root>
            {#if searchable}
                <Command.Input {placeholder} />
            {/if}
            <Command.List>
                <Command.Empty>{emptyText}</Command.Empty>
                <Command.Group>
                    {#each options as option}
                        <Command.Item
                            value={option.label}
                            onSelect={() => {
                                value = option.value;
                                closeAndFocusTrigger();
                                onSelect?.(option.value);
                            }}
                        >
                            <Check
                                class={cn(
                                    "mr-2 h-4 w-4",
                                    value !== option.value &&
                                        "text-transparent",
                                )}
                            />
                            {option.label}
                        </Command.Item>
                    {/each}
                </Command.Group>
            </Command.List>
        </Command.Root>
    </Popover.Content>
</Popover.Root>
