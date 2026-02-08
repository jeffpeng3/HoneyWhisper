<script>
    import { createEventDispatcher } from "svelte";

    export let model;

    const dispatch = createEventDispatcher();

    function handleCreate() {
        dispatch("create", model);
    }
</script>

<div class="hub-card">
    <div class="card-content">
        <h3>{model.name}</h3>
        <p class="model-id">{model.id}</p>
    </div>
    <div class="hub-actions">
        <a
            href={model.homepage || `https://huggingface.co/${model.id}`}
            target="_blank"
            class="link-btn">View on HF</a
        >
        <button class="btn-primary" on:click={handleCreate}
            >Create Profile</button
        >
    </div>
</div>

<style>
    .hub-card {
        background: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        height: 100%;
        box-sizing: border-box;
    }

    .card-content {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .hub-card h3 {
        margin: 0 0 8px 0;
        font-size: 1.1rem;
    }

    .model-id {
        font-size: 0.9rem;
        color: #6b7280;
        word-break: break-all;
        margin: 0 0 16px 0;
    }

    .hub-actions {
        display: flex;
        gap: 8px;
        margin-top: auto;
    }

    .link-btn {
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 6px;
        color: #4b5563;
        border: 1px solid #d1d5db;
        font-size: 0.9rem;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
    }
    .link-btn:hover {
        background: #f3f4f6;
    }

    button {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: white;
        cursor: pointer;
        font-weight: 500;
    }
    button:hover {
        background: #f3f4f6;
    }

    .btn-primary {
        background: #2563eb;
        color: white;
        border: none;
    }
    .btn-primary:hover {
        background: #1d4ed8;
    }
</style>
