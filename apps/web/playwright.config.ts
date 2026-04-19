import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 }
});
