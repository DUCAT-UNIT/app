# Remaining Maestro Coverage Gaps

This file tracks meaningful gaps after the maintained product suite reached 65 flows.

## Covered

- New wallet creation, import, PIN setup/unlock, wrong PIN, lockout, auto-lock.
- Wallet home, receive BTC/UNIT, QR receive, copy/share surfaces, pull refresh, asset detail, transaction history/detail.
- BTC/UNIT send completion, review back, invalid address, max amount, insufficient funds, taproot address, Turbo choice fallback.
- Settings navigation, preferences, security, seed backup, PIN change, lock, delete wallet, notifications, legal screens, advanced settings, and the Enable USDC developer gate.
- Vault create/deposit/borrow/repay/withdraw, full lifecycle, max borrow/repay, insufficient-fee guard.
- Cashu low-balance modal, mint navigation, receive-token screen, mint screen, mint initiation.
- Sepolia bridge/swap/redeem navigation, Sepolia ETH asset receive/send surfaces, invalid ETH recipient validation, invalid Mutinynet redeem destination validation, and quote/estimate screen assertions.
- Hidden Sepolia ETH/USDC wallet surfaces are covered through the Enable USDC developer unlock path.
- Liquidation dashboard opens from wallet and renders its primary action.
- Live/ad-hoc reviewer flows for vault open USDC settlement and USDC repay are present under `flows/test`.

## Missing Or Incomplete

### Sepolia / Bridge / ETH
- Native Sepolia ETH send success with a funded Sepolia account.
- Native Sepolia ETH insufficient-gas failure.
- USDC send success and insufficient-ETH-gas failure.
- wUNIT send success.
- Sepolia swap quote, summary, approval, execution, and funded failure guards.
- Redemption approval/burn and release-status polling.
- Bridge intent create, Mutinynet payment, Sepolia fulfillment, and fallback raw wUNIT handling.
- Bridge API outage/malformed-response UI banners under deterministic simulator control.

### Cashu / Turbo
- Cashu token creation/send flow.
- Cashu receive by paste with a real token.
- Cashu receive by QR/deep link.
- Melt ecash back to UNIT through completion.
- Turbo claim from deep link.
- Mint quote recovery after app restart.
- Locked-change recovery.

### Liquidation
- Liquidation empty state.
- Liquidation available-vault selection.
- Liquidation amount input and review tabs.
- Liquidation claim success path.
- Liquidation broadcast/error path.

### Deep Links / QR / Background
- Bitcoin URI deep link routes into send flow.
- Cashu token deep link routes into receive/claim flow.
- Invalid QR shows a recoverable error.
- App background -> foreground state preservation beyond lock screen.
- Background task state save/reload.

### Error Handling
- Backend outage banners for balance/vault/bridge APIs.
- Broadcast failure and retry UX.
- ErrorBoundary fallback rendering and recovery path.
- Unconfirmed UTXO warning path.

## Required Environment For 10/10 E2E Confidence

- Deterministic Mutinynet faucet funding.
- Deterministic Sepolia ETH funding for the E2E seed or test account.
- Seeded Sepolia USDC/wUNIT balances or a deterministic bridge fixture.
- Stable Cashu test mint with resettable test tokens.
- Liquidation fixture API that can expose at least one claimable vault on demand.
- CI simulator images with permissions, biometric/passkey behavior, and deep links configured.
