import { mount } from 'svelte';
import '../../src/app.css';
import App from './Options.svelte';

const app = mount(App, {
    target: document.getElementById('app'),
});

export default app;
