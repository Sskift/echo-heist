import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  // GitHub's software WebGL renderer also compiles the real scene shaders.
  timeout: process.env.CI || process.env.ECHO_SOFTWARE_WEBGL ? 180_000 : 30_000,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: {
      // Select the software WebGL backend explicitly on GPU-less runners.
      args: process.env.CI || process.env.ECHO_SOFTWARE_WEBGL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    },
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1024 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
