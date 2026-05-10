# Manual QA Bug Hunt - 2026-05-10

Target: Ducat app on iOS simulator through `npx serve-sim` and Codex in-app browser.

Branch at start: `codex/release-v0.0.6-build4-main`

## Running Log

1. Started fresh `serve-sim` preview on `http://localhost:3201` for simulator `C9DC414A-1800-40FC-91DF-7A29B1D35BB0` after clearing a stale preview process.
2. Attached browser control to the existing Codex in-app browser tab at `http://localhost:3201/?reconnect=1778366195502`.
3. Used `npx serve-sim gesture` to dismiss the accidental iOS icon edit menu and returned the simulator to the home screen.
4. Switched to browser-controlled interaction against the live `serve-sim` preview, clicked the DUCAT app icon, and reached the app PIN screen.
5. Entered the existing simulator wallet PIN through the browser-controlled `serve-sim` preview and reached the main wallet dashboard.

## Current Observations

- Main dashboard loaded and is not stuck on node connection.
- Main dashboard shows Total Balance USD `$17.77`, Vault collateral around `0.19947020`, BTC balance `0.00000000`, UNIT balance `0.00`.
- Expo warning overlay is visible at the bottom (`Open debugger to view warnings.`); this may obscure low screen controls during manual testing but does not block the main dashboard controls.

## Scanner Flow

6. Opened the scan icon from the dashboard using browser control on the live `serve-sim` preview.
7. Verified the camera pre-permission screen has both `Continue`, `Cancel`, and a top-right `X`.
8. Tapped `Cancel`; verified it returns to the main dashboard.
9. Reopened scanner, tapped `Continue`, and verified iOS camera permission prompt appears.
10. Tapped `Don't Allow`; verified the app shows a blocked-camera state with `Open Settings`, `Cancel`, and top-right `X`.
11. Tapped `Open Settings`; verified iOS opens the DUCAT app settings page.
12. Sent a quick tap through the `serve-sim` WebSocket control channel to enable the Camera toggle, then returned to DUCAT.
13. Re-entered PIN via `serve-sim` taps.
14. Opened scanner again; verified the live scanner screen opens and the top-right `X` returns to the dashboard.

Scanner result: fixed behavior is present. I did not reproduce the prior "no Cancel/Back" trap or the "Continue does nothing" failure.

## Preferences / Notifications

15. Opened Settings -> Preferences.
16. Verified Notifications displayed `OFF` while iOS app settings also showed Notifications `Off`; this matched current system state.
17. Tapped Notifications -> Enable. The app returned to the PIN screen without an iOS prompt and, after unlocking, Preferences still showed Notifications `OFF`.

Issue found: enabling notifications from Preferences appears to fail silently in this simulator state and forces re-authentication. Needs code inspection/fix.

Fix applied:
- Updated the post-auth notification enable continuation so it calls back into the active settings hook, requests OS notification permission, persists only the resulting granted/denied state, and updates the visible Preferences state.
- Reran focused tests: `npx jest hooks/__tests__/useAppSettings.test.tsx hooks/__tests__/usePostAuthHandler.test.tsx --runInBand`.
- Reran `npx tsc --noEmit`.
- Reloaded the app in the live `serve-sim` preview, toggled Notifications OFF, then attempted ON again. With simulator OS notifications denied, Preferences stays `OFF` after PIN instead of falsely showing/storing `ON`; when the pending enable from the earlier flow was granted, Preferences reflected `ON` after reload.

## Turbo UNIT Settings

18. Opened Settings -> Turbo UNIT.
19. Tapped Recover Locked Change. It did not show the previous `Cannot find module` error or hang.
20. Tapped Recover Failed Mint. The recover form opened with stored quote data.
21. Submitted Recover Mint. It returned a visible `Failed to recover mint: HTTP 400` alert with an OK button; no stuck logo or loop.
22. Opened Redeem Turbo UNIT Token. Verified the Receive Turbo UNIT screen has a back button.
23. Opened Receive Token. Verified it has a back button and empty Receive does not hang.
24. Opened Mint from Runes. Typed amount `1` using browser keypress forwarded to the simulator. Button appears active, but with zero UNIT balance tapping it produced no visible result or error.

Issue found: Mint Turbo UNIT should either be disabled with a clearly disabled style when UNIT is unavailable, or show a visible validation error when tapped.

Fix applied:
- Added an on-chain UNIT balance guard to the Turbo UNIT mint receive hook so mint quote creation is blocked when the requested amount exceeds available on-chain UNIT.
- Added visible available-balance/warning copy on the Mint Turbo UNIT screen and disabled the mint button when no on-chain UNIT is available.
- Added focused tests for insufficient on-chain UNIT guard coverage.
- Reran focused tests: `npx jest hooks/__tests__/useCashuReceive.test.tsx hooks/__tests__/useAppSettings.test.tsx hooks/__tests__/usePostAuthHandler.test.tsx --runInBand`.
- Reran `npx tsc --noEmit`.
- Reloaded the live `serve-sim` browser preview, opened Settings -> Turbo UNIT -> Redeem Turbo UNIT Token -> Mint from Runes, and verified the screen now shows `You need on-chain UNIT before minting Turbo UNIT.` with a clearly disabled button.
- Opened Receive Token from the same Turbo UNIT chooser and verified its back button returns to the chooser.

## Vault BTC Deposit / Withdraw

25. From the dashboard, opened Withdraw -> Vault.
26. Pressed Max on Withdraw BTC. The app calculated `0.19946217 BTC` on the first run and left a dust collateral remainder.
27. Tapped Continue -> Confirm & Sign. The status advanced past Building Transaction and reached `Withdrawal Complete!`.
28. Tapped Done and verified the dashboard reflected BTC balance after refresh/confirmation.
29. Opened Deposit -> Vault.
30. Pressed Max on Deposit BTC. The app calculated `0.19945892 BTC`.
31. Tapped Continue -> Confirm & Sign. The status advanced past Building Transaction and reached `Deposit Complete!` with tx `3b04871e...05ce9d40`.
32. Immediately tapped Done, reopened Deposit -> Vault with BTC at zero, pressed Max, and verified the amount stayed `0.00000000` with Continue disabled. It did not enter the Building Transaction step.
33. Reopened Withdraw -> Vault after the max deposit, pressed Max, and confirmed another max withdrawal for `0.19945567 BTC`.
34. The second withdrawal reached `Withdrawal Complete!` with tx `9a095453...c020668e`.
35. Used the app refresh/history surface after returning to dashboard. Latest vault deposit/withdraw entries showed `Confirmed` in Transaction History.

Vault result: I did not reproduce the reported max deposit/max withdraw Building Transaction hang on this build. Repeat deposit after a max deposit was blocked cleanly at zero BTC instead of entering a stuck transaction build.

## BTC Send / Activity

36. Opened Bitcoin asset detail from dashboard after the second max withdrawal.
37. Verified the Bitcoin asset Activity list showed confirmed entries rather than permanently pending entries.
38. Opened Bitcoin receive screen and verified the receive address screen has a back button and copy status.
39. Generated a fresh valid mutinynet/testnet P2WPKH recipient address for the send test: `tb1qwcpfjc5hntd2zgzxgp7e65gmnw20dy3kts3ll3`.
40. Opened Send BTC.
41. Pasted the generated recipient through the simulator paste prompt and verified the form marked it `Valid`.
42. Tried forwarding a tiny typed amount through browser keypresses; the canvas forwarded digits poorly and produced a non-reviewable tiny amount. Switched to Max because max BTC send is also a critical send path and mutinynet funds were approved for testing.
43. Pressed Max. The app calculated `0.19945259 BTC` with `308 sats` fee.
44. Tapped Review -> Confirm and Sign.
45. Verified the send did not show `Failed to sign and broadcast transaction`; it reached `Transaction Sent!` with tx `b35bace0...274636e4`.
46. Tapped Done and waited on the Bitcoin asset screen. Within about 10 seconds it updated to `0.00000000 BTC`, showed a `BTC transaction confirmed` toast, and the latest activity row showed the max send as `Confirmed`.

BTC send/activity result: fixed behavior is present on the tested max-send path. I did not reproduce the reported `Failed to sign and broadcast transaction` error or stale pending activity after waiting for the transaction callback.

## UNIT / Turbo / Repay Disabled States

47. Opened UNIT asset detail. Verified the balance split displayed `0.00 UNIT onchain` and `165.60 UNIT turbo`.
48. Opened Send UNIT with only Turbo UNIT and no BTC. The form opened, Turbo UNIT was enabled, Review stayed disabled, and a visible warning said BTC was needed for transaction fees. It did not hang or show the stuck Ducat logo.
49. Returned to dashboard and pressed Repay with zero vault debt. No repay flow opened, which is expected for zero debt.
50. Pressed Borrow with near-zero BTC. Borrow opened and showed a visible `Insufficient BTC for transaction fees` warning instead of hanging.
51. Tried to trigger a new airdrop from the dashboard state after draining BTC. No modal opened because this wallet/IP is in the faucet cooldown window.
52. Called the app faucet endpoint with the wallet BTC receive address to confirm the backend state. The faucet returned HTTP 429 with `You can only claim the faucet once every 24 hours per IP or wallet address.`

Repay/borrow result: I could not create new debt after the BTC max-send drained the wallet and the faucet rate limit prevented refilling. Disabled/insufficient-fee paths are visible and non-hanging.
