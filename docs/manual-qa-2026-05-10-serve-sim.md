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

## Extended Settings / Security Pass

53. Returned to Settings -> Preferences and toggled Show Zero Value Assets ON, then OFF again. The value updated immediately both times.
54. Opened Settings -> Security.
55. Opened Auto-Lock. Verified the native option sheet shows `30 seconds`, `1 minute`, `5 minutes`, `15 minutes`, `30 minutes`, and `Cancel`.
56. Tapped Cancel and verified return to Security.
57. Opened Change PIN. The app correctly required the current PIN first.
58. Entered the current PIN. The app moved to `Enter New PIN` and showed a `Cancel` action.
59. Tapped Cancel. The app returned to Settings without changing the PIN.
60. Opened Settings -> Advanced.
61. Opened Turbo UNIT Default. Verified the threshold sheet opens with `100.00`, `500.00`, `1,000.00`, and `All transfers`, and closes via X.
62. Opened Select Account. Verified the modal contains an account number input plus Cancel/Switch buttons. Tapped Cancel and returned to Settings.
63. Opened Settings -> About.
64. Opened Terms of Service and verified the content renders and the back button returns to Settings.
65. Opened Clear App Cache. Verified the confirmation modal explains what will be cleared and has Cancel/Clear Cache. Tapped Cancel.
66. Opened Lock Wallet. Verified the confirmation modal has Cancel/Lock.
67. Tapped Lock. The app returned to the PIN screen.
68. Re-entered PIN and verified the dashboard loaded normally.

Extended settings result: no dead ends or frozen screens found in these settings/security/about/modal paths.

## Extended Serve-Sim Browser Pass

69. Continued from the live `serve-sim` browser preview after the user requested more coverage.
70. Verified the `serve-sim` process for simulator `C9DC414A-1800-40FC-91DF-7A29B1D35BB0` was still running on port `3201`.
71. Returned to Settings -> Advanced and opened Enable USDC.
72. Verified the Enable USDC modal has a developer password field plus Cancel/Enable.
73. Pasted text through the simulator paste affordance and tapped Enable. The app showed an inline `Incorrect Enable USDC password` alert and stayed dismissible.
74. Tapped Cancel and verified return to Advanced.
75. Opened Select Account again. Verified Switch Account modal opens with account number input, Cancel, and Switch. Tapped Cancel and returned to Settings.
76. Opened Settings -> Security -> Delete Local Wallet. Verified the destructive confirmation modal explains the local deletion and offers Cancel/Delete. Tapped Cancel.
77. Opened Backup Wallet. The app required current PIN before showing recovery data.
78. Entered the current PIN. Verified the recovery phrase screen keeps words masked by default, has `Show Recovery Phrase`, and has `Done`.
79. Tapped Done without revealing the phrase and verified return to Settings.
80. Opened Enable Passkey Recovery. Verified the modal offers Enable Passkey and Skip for Now. Tapped Skip for Now and returned to Security.

Security result: destructive and sensitive settings are guarded and have working cancel/exit paths. Recovery words remain masked unless explicitly revealed.

## Vault / Receive / Share / Activity Follow-Up

81. Returned to dashboard and reopened Deposit -> Vault with zero BTC.
82. Verified the amount stayed `0.00000000`, Max did not fill a spendable amount, and Continue remained disabled.
83. Opened Withdraw -> Vault with the small remaining collateral.
84. Verified the amount stayed `0.00000000`, Max did not enter a building/signing flow, and Continue remained disabled.
85. Opened Deposit -> Bitcoin receive screen.
86. Verified the QR code renders, the address is visible, copy target is tappable, and Share opens the iOS share sheet.
87. Dismissed the iOS share sheet and returned to the Bitcoin receive screen.
88. Opened UNIT asset detail.
89. Verified chart range buttons `1D`, `1W`, `1M`, and `1Y` switch without crashing or layout break.
90. Opened the UNIT About tab and verified content renders.
91. Opened UNIT receive screen. Verified QR/address render, copy target is tappable, and Share opens the iOS share sheet.
92. Dismissed the iOS share sheet and returned to the UNIT receive screen.
93. Opened UNIT Send from asset detail. Pasted the wallet UNIT address from the simulator clipboard and pressed Max.
94. Verified the address was marked Valid and amount filled `165.60 UNIT`.
95. With Turbo UNIT enabled and no BTC wallet balance, Review remained disabled and a visible warning stated `You need BTC in your wallet to pay for transaction fees`.
96. Opened the scanner from the UNIT Send address field. Verified the live scanner screen has a top-right X and returns to the send form.
97. Opened UNIT Activity, tapped a confirmed row, and verified the transaction detail sheet shows `Confirmed`, asset, transaction ID, and explorer action.
98. Dismissed the transaction detail sheet by dragging it down.
99. Opened dashboard Transaction History and verified mixed BTC/vault rows render as `Confirmed`.
100. Opened a BTC transaction detail from Transaction History and tapped View in Explorer.
101. Verified Safari opened `mutinynet.com` and showed the transaction as confirmed with block height and confirmations.
102. Tapped the system back-to-DUCAT control. Ducat returned to the PIN screen, which is expected after leaving the app.
103. Re-entered PIN and verified dashboard restored normally.
104. Opened Settings -> Preferences again. Toggled Show Zero Value Assets ON and OFF without layout break.
105. Opened Notifications and verified the Enable Notifications confirmation modal appears. Tapped Cancel and confirmed the setting stayed `OFF`.

Extended pass result: the additional browser-driven `serve-sim` paths did not expose another freeze, navigation trap, or stuck transaction state. The main remaining constraint is wallet funding: after the intentional BTC max-send test, the wallet/IP faucet is rate-limited, so further funded BTC/vault/borrow transactions cannot be repeated until new mutinynet funds are available.

## Reconnect / Liquidation / Validation Follow-Up

106. Navigated the in-app browser to a fresh `http://localhost:3201/?reconnect=...` URL.
107. The first screenshot attempt timed out while the preview reconnected, then the same tab recovered and showed the app live on Preferences. No manual simulator restart was needed.
108. Returned to dashboard and opened the bottom-left Liquidations entry point.
109. Verified Liquidations first shows `Loading Vaults...`, then resolves to the amount form after waiting for the network fetch.
110. Verified the USD/BTC display toggle changes the displayed investment/profit units without crashing.
111. Opened the Vaults dropdown/accordion. It expands and shows the empty-state instruction `Adjust slider to select vaults`.
112. Pressed Continue at zero investment. The app stayed on the same form and did not start a claim/build flow.
113. Used the bottom-left Liquidations/Dashboard toggle to return to the dashboard.
114. Opened Send BTC with zero BTC balance.
115. Pasted `not-a-bitcoin-address` through the simulator clipboard permission prompt.
116. Verified the field displays `Invalid Bitcoin address format`, marks the recipient `Invalid`, and keeps Review disabled.
117. Opened the Send BTC fee selector and verified Economy, Standard, and Priority options render. Selected Priority and verified the displayed sats estimate updates.
118. Reopened Borrow USD. Verified it still shows `Insufficient BTC for transaction fees`, keeps Continue disabled, and fee selector expands.
119. Pressed Repay with zero debt again. The dashboard remained in place, with no dead-end repay screen or stuck logo.

Validation result: reconnect, liquidation empty/zero states, invalid address validation, fee dropdowns, and zero-debt repay all remain navigable and non-hanging under `serve-sim`.

## About / App Resume Follow-Up

120. Opened Settings -> About again.
121. Verified About shows Terms of Service, Privacy Policy, and Version `1.0.0`.
122. Opened Privacy Policy and verified the legal content renders.
123. Attempted to scroll the Privacy Policy. A bottom-edge drag hit the iOS home gesture and sent the simulator to the home screen.
124. Reopened DUCAT from the simulator home screen using the live `serve-sim` browser controls.
125. Verified DUCAT resumed to the PIN lock screen, not a blank/stuck state.
126. Entered PIN and verified the dashboard restored normally.

Resume result: app resume from iOS home after a gesture interruption works and returns through PIN unlock to dashboard.

## Funded Retest After Additional BTC

127. User sent additional mutinynet BTC to the current wallet receive address.
128. Refreshed the live `serve-sim` app. Transaction History showed a confirmed `0.50000000 BTC` receive at about 3:03 AM, and the dashboard total balance updated.
129. Opened Deposit -> Vault with the funded wallet.
130. Pressed Max. The app calculated `0.49999675 BTC`, leaving fee/reserve, and Continue enabled.
131. Tapped Continue -> Confirm & Sign.
132. Observed the exact reported third checkpoint, `Building transaction` / `Validating details...`.
133. Waited about 25 seconds. The flow advanced out of Building Transaction and reached `Deposit Complete!`.
134. Recorded completed deposit tx `414e60e2...85d6a446`.
135. Immediately tapped Done and reopened Deposit -> Vault without waiting for the vault balance to fully refresh.
136. Pressed Max again. The app kept the amount at `0.00000000`, disabled Continue, and showed the warning `A vault transaction is still updating. Wait for the vault balance to update before starting another vault operation.`
137. Waited for the vault state to settle and reopened Withdraw -> Vault.
138. Pressed Max. The app calculated `0.49999350 BTC` and Continue enabled.
139. Tapped Continue -> Confirm & Sign.
140. Observed the third checkpoint, `Building transaction` / `Validating details...`.
141. Waited about 25 seconds. The flow advanced out of Building Transaction and reached `Withdrawal Complete!`.
142. Recorded completed withdraw tx `67d981c4...7ee1e380`.

Funded retest result: with fresh BTC, both full/max vault deposit and full/max vault withdraw completed through the previously reported third-checkmark step. Immediate duplicate vault operation after deposit is now blocked with an explicit warning and disabled Continue instead of entering a stuck build flow.

## Additional Funded Borrow / Turbo Repay Pass

143. Continued testing because fresh funding made more flows reachable.
144. Opened Borrow USD after the max withdraw. With only dust collateral, borrow opened but max remained zero.
145. Opened Deposit -> Vault and entered a manual partial amount `0.1 BTC` using the simulator keyboard through the browser-controlled `serve-sim` preview.
146. Verified the amount normalized to `0.10000000 BTC`, updated collateral preview, and enabled Continue.
147. Tapped Continue -> Confirm & Sign.
148. Partial deposit completed successfully with tx `b91230f1...fa0ef01f`.
149. Waited for vault state to update, then opened Borrow USD again.
150. Pressed Max and verified borrow max populated to `$5,037.00`; reduced the amount manually to `$500.00`.
151. Tapped Continue and reached the payout-choice screen.
152. Selected `Receive as TurboUNIT` and continued to review.
153. Confirmed the borrow. It advanced past Building Transaction, waited on `Waiting for TurboUNIT proofs from the mint...`, and eventually reached `TurboUNIT Received!`.
154. Recorded borrow creation tx `698d961b...9cb02765` and TurboUNIT mint-send tx `10aa2ab0...baefeed8`.
155. Tapped Done, waited for state to settle, then opened Repay USD.
156. Pressed Max for the `$500.00` debt.
157. Continued to repay source selection. `Repay with UNIT` was disabled because spendable on-chain UNIT was `0.00`; `Repay with TurboUNIT` was available with `665.60` available.
158. Selected `Repay with TurboUNIT` and continued to review.
159. Confirmed the repay. It showed the staged repay status, then reached `Repayment Complete!`.
160. Recorded repay tx `3f362464...82dfd688`.

Borrow/Turbo repay result: the funded borrow-to-TurboUNIT and repay-with-TurboUNIT paths completed. I did not reproduce the reported stuck Ducat logo after Turbo UNIT repay in this run.

## Funded UNIT Send / Turbo Token Claim Pass

161. Opened UNIT Send after the funded borrow/repay pass.
162. Copied the wallet's current UNIT receive address from the UNIT receive screen using the app UI, then pasted it into Send UNIT.
163. Verified the copied address was marked `Valid`.
164. Tried entering `10` after an existing `0.00` edit value through the simulator keyboard. This produced a hidden sub-cent amount while the visible value still rendered as `0.00 UNIT`.
165. Observed a real bug: Review became enabled while the visible amount was `0.00 UNIT`, and tapping Review produced `Failed to create token: invalid inputs`.
166. Fixed send validation so UNIT sends require at least one smallest unit (`0.01 UNIT`) before Review can enable.
167. Added a focused test covering sub-cent UNIT amounts.
168. Ran `npx jest screens/send/__tests__/useSendValidation.test.ts --runInBand` successfully.
169. Ran `npx tsc --noEmit` successfully.
170. Verified the same live `0.00 UNIT` state now keeps Review disabled.
171. Entered a clean `10.00 UNIT` amount and verified Review enabled.
172. Tapped Review with Turbo UNIT enabled. The app progressed through `Creating Token`, including URL shortening, and reached `Turbo Token Ready`.
173. Tapped `Open Link`. Safari opened the redeem page at `redeem.ducatprotocol.com` and showed a `10.00 UNIT` unspent claim.
174. Tapped `Claim in Ducat`, accepted the iOS `Open in DUCAT?` prompt, and unlocked via PIN.
175. Verified the app returned to the dashboard and the UNIT balance increased to `303.37`, confirming the claim path completed.

UNIT/Turbo send result: found and fixed a sub-cent validation bug that let `0.00 UNIT` visually enable Review and fail token creation. Valid `10.00 UNIT` Turbo token creation and claim through the web redeem page completed successfully.
