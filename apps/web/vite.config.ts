import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

const devHost = process.env.TAURI_DEV_HOST || '127.0.0.1';

export default defineConfig({
	base: './',
	plugins: [sveltekit()],
	clearScreen: false,
	server: {
		host: devHost,
		port: 5173,
		strictPort: true,
		hmr: process.env.TAURI_DEV_HOST
			? {
					protocol: 'ws',
					host: devHost,
					port: 5173
				}
			: undefined
	},
	preview: {
		host: devHost,
		port: 4173,
		strictPort: true
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
