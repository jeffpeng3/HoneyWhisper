import { defineWxtModule } from 'wxt/modules';

export default defineWxtModule({
    name: 'polling-watch',
    hooks: {
        'vite:devServer:extendConfig': (config: any) => {
            config.server ??= {};
            config.server.watch ??= {};
            config.server.watch.usePolling = true;
            config.server.watch.interval = 200;
        },
    },
});
