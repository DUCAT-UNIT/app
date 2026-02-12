# Maestro Coverage Gaps

This is a best-effort mapping between `e2e/FLOW_TEST_GUIDE.md` and existing Maestro flows. It identifies what is already automated and what remains for a complete E2E suite.

## Covered (Mapped)
- 1.1 New Wallet Creation -> `auth/01-create-wallet.yaml`
- 1.2 Import Wallet from Seed Phrase -> `auth/02-import-wallet.yaml`, `auth/09-import-seed-typed.yaml`
- 1.5 PIN Entry (Unlock) -> `auth/03-pin-unlock.yaml`
- 1.7 PIN Lockout (Failed Attempts) -> `auth/04-wrong-pin.yaml`
- 2.1 View Total Balance -> `wallet/01-view-balance.yaml`
- 4.1 Receive BTC - Display QR -> `wallet/02-receive-address.yaml`
- 4.2 Receive UNIT - Display QR -> `wallet/02-receive-address.yaml`
- 8.1 BTC Detail - View Price Chart -> `wallet/03-btc-detail.yaml`
- 8.5 UNIT Detail - View Balance Breakdown -> `wallet/04-unit-detail.yaml`
- 9.1 View All Transactions -> `wallet/11-transaction-history.yaml`
- 9.4 Transaction Item Types -> `wallet/06-history.yaml`
- 3.1 Send BTC - Standard Flow -> `send/01-send-btc.yaml`
- 3.2 Send UNIT - Standard Flow -> `send/02-send-unit.yaml`
- 3.8 Send - Invalid Address Error -> `send/03-send-invalid-address.yaml`
- 6.x Vault flows -> `vault/03-create-vault-screen.yaml`, `vault/04-create-vault-full.yaml`, `vault/05-deposit-btc.yaml`, `vault/06-borrow-unit.yaml`, `vault/07-repay-unit.yaml`, `vault/08-withdraw-btc.yaml`
- 7.1 Navigate to Settings -> `settings/01-navigate-settings.yaml`
- 7.4 Security - Change PIN -> `settings/02-change-pin.yaml`
- 7.10 About Screen -> `settings/05-about.yaml`
- 7.2 Preferences - Toggle Options -> `settings/07-toggle-preferences.yaml`
- 7.11 Cashu Settings -> `settings/09-cashu-settings.yaml`
- 7.6 Security - Delete Wallet -> `settings/11-delete-wallet-modal.yaml`

## Missing (No Current Maestro Coverage)
- 1.3 Passkey Wallet Creation
- 1.4 Passkey Wallet Restore
- 1.6 Biometric Authentication
- 2.2 View Asset Cards
- 2.3 Pull to Refresh
- 2.4 Account Switcher - Switch Accounts
- 2.5 Account Switcher - Create New Account
- 3.3 Send UNIT - Turbo Flow
- 3.4 Send - Scan QR for Address
- 3.5 Send - Paste Address
- 3.6 Send - MAX Amount
- 3.7 Send - Insufficient Balance Error
- 4.3 Receive - Copy Address
- 4.4 Receive - Full Screen QR Modal
- 4.5 Receive - Share QR
- 5.1 Cashu Send - Generate Token
- 5.2 Cashu Receive - Scan Token
- 5.3 Cashu Receive - Paste Token
- 5.4 Mint (UNIT → Ecash)
- 5.5 Melt (Ecash → UNIT)
- 5.6 Low Ecash Balance - Auto Top-up Prompt
- 5.7 Token Details Inspection
- 6.1 Enter Vault via Tap
- 6.2 Enter Vault via Swipe
- 6.3 Exit Vault via Swipe
- 6.4 Vault WebView Operations
- 7.3 Security - View Seed Phrase
- 7.5 Security - Toggle Biometrics
- 7.7 Advanced - Advanced Mode Toggle
- 7.8 Advanced - Ecash Threshold
- 7.9 Advanced - Clear Cache
- 7.12 Turbo History
- 7.13 Turbo QR Code
- 8.2 BTC Detail - Change Time Range
- 8.3 BTC Detail - View About Tab
- 8.4 BTC Detail - View Activity Tab
- 8.6 UNIT Detail - View Turbo List
- 9.2 View BTC Transactions Only
- 9.3 View UNIT Transactions Only
- 10.1 Network Error - Banner Display
- 10.2 Invalid QR Scan - Error Toast
- 10.3 Transaction Failure - Error Modal
- 10.4 JS Error - ErrorBoundary
- 10.5 Unconfirmed UTXO Warning
- 10.6 Mint Recovery Flow
- 11.1 App Background → Foreground
- 11.2 Inactivity Timeout → Auto-lock
- 11.3 Deep Link - Navigation
- 11.4 Background Task - State Save

## Numbering Gaps in Maestro Folders
- `auth`: missing `06`, `07`, `08`
- `settings`: missing `03`
- `wallet`: missing `05`, `07`

## Notes
- Some existing flows likely cover only part of the manual steps; verify each mapping against expected UI steps.
- The passkey and biometric flows may require simulator entitlement configuration or real device testing.
