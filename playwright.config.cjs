/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: ".",
  testMatch: /legacy-smoke\.spec\.js/,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "python -m http.server 4173",
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000,
  },
};

