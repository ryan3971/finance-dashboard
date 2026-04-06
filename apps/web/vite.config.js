import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        sentryVitePlugin({
            org: 'ryan-tyrrell-25',
            project: 'frontend-finance-dashboard',
        }),
    ],
    build: {
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@finance/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
