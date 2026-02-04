<script>
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
    import Combobox from "$lib/components/ui/combobox/Combobox.svelte";
    import { i18n } from "#i18n";

    let {
        profiles = $bindable([]),
        editingProfileId = $bindable(null),
        tempProfile = $bindable({}),
        onSave = () => {},
    } = $props();

    function createProfile() {
        tempProfile = {
            id: crypto.randomUUID(),
            name: "New Profile",
            backend: "webgpu",
            model_id: "onnx-community/whisper-tiny",
            quantization: "q4",
            remote_endpoint: "",
            remote_key: "",
        };
        editingProfileId = tempProfile.id;
    }

    function editProfile(profile) {
        tempProfile = { ...profile };
        editingProfileId = profile.id;
    }

    function saveProfile() {
        const index = profiles.findIndex((p) => p.id === tempProfile.id);
        if (index !== -1) {
            profiles[index] = tempProfile;
        } else {
            profiles.push(tempProfile);
        }
        profiles = [...profiles]; // Trigger update
        editingProfileId = null;
        onSave();
    }

    function deleteProfile(id) {
        if (confirm(i18n.t("profiles.deleteConfirm"))) {
            profiles = profiles.filter((p) => p.id !== id);
            onSave();
        }
    }

    function cancelEdit() {
        editingProfileId = null;
    }
</script>

{#if !editingProfileId}
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">{i18n.t("profiles.title")}</h2>
        <Button onclick={createProfile}
            >{i18n.t("profiles.newProfileBtn")}</Button
        >
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each profiles as profile}
            <Card.Root>
                <Card.Header>
                    <Card.Title>{profile.name}</Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <Badge
                                variant={profile.backend === "remote"
                                    ? "destructive"
                                    : "secondary"}>{profile.backend}</Badge
                            >
                        </div>
                        <span
                            class="text-sm text-muted-foreground truncate"
                            title={profile.model_id}
                            >{profile.model_id || "N/A"}</span
                        >
                    </div>
                </Card.Content>
                <Card.Footer class="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => editProfile(profile)}
                        >{i18n.t("profiles.edit")}</Button
                    >
                    <Button
                        variant="destructive"
                        size="sm"
                        onclick={() => deleteProfile(profile.id)}
                        >{i18n.t("profiles.delete")}</Button
                    >
                </Card.Footer>
            </Card.Root>
        {/each}
    </div>
{:else}
    <Card.Root>
        <Card.Header>
            <Card.Title>
                {profiles.find((p) => p.id === tempProfile.id)
                    ? i18n.t("profiles.editTitle")
                    : i18n.t("profiles.newTitle")}
            </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
            <div class="grid gap-2">
                <Label for="profile-name">{i18n.t("profiles.nameLabel")}</Label>
                <Input
                    id="profile-name"
                    type="text"
                    bind:value={tempProfile.name}
                />
            </div>

            <div class="grid gap-2">
                <Label>{i18n.t("profiles.backendLabel")}</Label>
                <RadioGroup.Root
                    bind:value={tempProfile.backend}
                    class="flex space-x-4"
                >
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="webgpu" id="backend-webgpu" />
                        <Label for="backend-webgpu"
                            >{i18n.t("profiles.localWebgpu")}</Label
                        >
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="wasm" id="backend-wasm" />
                        <Label for="backend-wasm"
                            >{i18n.t("profiles.localWasm")}</Label
                        >
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="remote" id="backend-remote" />
                        <Label for="backend-remote"
                            >{i18n.t("profiles.remoteApi")}</Label
                        >
                    </div>
                </RadioGroup.Root>
            </div>

            {#if tempProfile.backend === "webgpu" || tempProfile.backend === "wasm"}
                <div class="grid gap-2">
                    <Label for="model-id"
                        >{i18n.t("profiles.modelIdLabel")}</Label
                    >
                    <Input
                        id="model-id"
                        type="text"
                        bind:value={tempProfile.model_id}
                        placeholder="onnx-community/whisper-tiny"
                    />
                </div>
                <div class="grid gap-2">
                    <Label>{i18n.t("profiles.quantizationLabel")}</Label>
                    <Combobox
                        value={tempProfile.quantization}
                        options={[
                            { value: "q4", label: "Q4 (Default)" },
                            { value: "int8", label: "Int8" },
                            { value: "fp32", label: "FP32" },
                        ]}
                        placeholder="Select quantization"
                        onSelect={(v) => (tempProfile.quantization = v)}
                    />
                </div>
            {:else}
                <div class="grid gap-2">
                    <Label for="api-endpoint"
                        >{i18n.t("profiles.apiEndpointLabel")}</Label
                    >
                    <Input
                        id="api-endpoint"
                        type="text"
                        bind:value={tempProfile.remote_endpoint}
                        placeholder="http://localhost:9000/v1/audio/transcriptions"
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="api-key">{i18n.t("profiles.apiKeyLabel")}</Label
                    >
                    <Input
                        id="api-key"
                        type="password"
                        bind:value={tempProfile.remote_key}
                    />
                </div>
            {/if}
        </Card.Content>
        <Card.Footer class="flex justify-end gap-2">
            <Button variant="outline" onclick={cancelEdit}
                >{i18n.t("profiles.cancelBtn")}</Button
            >
            <Button onclick={saveProfile}>{i18n.t("profiles.saveBtn")}</Button>
        </Card.Footer>
    </Card.Root>
{/if}
