# U3 dashboard evidence

Unmodified local Chromium captures, October 13, 2026 (Pacific/Fiji). The emulator images show actual saved data created through the application, including an original geometric drawing. They are not Google AI output or deployment evidence. Firebase's emulator warning banner is intentionally retained.

- [Signed-out desktop](dashboard-signed-out-desktop.png) and [signed-out phone](dashboard-signed-out-mobile.png).
- [Empty library](dashboard-empty.png) and [project creation](dashboard-create.png).
- [Populated grid with private source preview](dashboard-populated.png), [list view](dashboard-list.png) and [phone layout](dashboard-mobile.png).
- [Partial-page search](dashboard-partial-search.png), [loading](dashboard-loading.png) and [recoverable network failure](dashboard-network-error.png).

Regenerate using `npm run test:e2e` and `npm run test:emulators`. Source captures are in `test-results/unconfigured/smoke-*/` and `test-results/emulators/e2e-dashboard.emulator-*/` / `e2e-ui-baseline.emulator-*/`. Review before archiving. The test deliberately delays/aborts real requests for loading/error states, then verifies successful recovery; successful API responses are not fabricated.

See [behavior, private thumbnail lifecycle and setup](../dashboard.md) and [actual test results](../ui-upgrade-results.md).
