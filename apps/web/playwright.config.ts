import { defineConfig } from '@playwright/test';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= new URL('./.playwright-browsers', import.meta.url).pathname;

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 }
});
