<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Ducat wallet app. The project already had a `analyticsService.ts` wrapper and `analyticsEvents.ts` constants, but only `app_opened`, `pin_setup_completed`, and `onboarding_completed` were wired up. This integration connected the remaining high-value events across authentication, transaction, and vault flows. Environment variables (`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`) were configured in `.env`.

| Event | Description | File |
|---|---|---|
| `app_opened` | App launched (already tracked) | `App.tsx` |
| `pin_setup_completed` | User completes PIN entry during onboarding (already tracked) | `hooks/useOnboardingHandlers.ts` |
| `onboarding_completed` | Full onboarding flow finished (already tracked) | `hooks/useOnboardingHandlers.ts` |
| `receive_screen_viewed` | User views QR receive screen (already tracked) | `screens/wallet/ReceiveQRScreen.tsx` |
| `address_copied` | User copies wallet address (already tracked) | `screens/wallet/ReceiveQRScreen.tsx` |
| `address_shared` | User shares wallet address (already tracked) | `screens/wallet/ReceiveQRScreen.tsx` |
| `auth_success` | PIN authentication succeeded | `screens/auth/LockScreen.tsx` |
| `auth_failed` | PIN authentication failed (with remaining_attempts property) | `screens/auth/LockScreen.tsx` |
| `biometric_enabled` | User enables Face ID/Touch ID during onboarding | `screens/auth/PinSetupScreen.tsx` |
| `biometric_skipped` | User skips biometric setup during onboarding | `screens/auth/PinSetupScreen.tsx` |
| `send_broadcast` | BTC or UNIT transaction broadcast to network (with txid_prefix, is_turbo) | `screens/send/ConfirmationScreen.tsx` |
| `vault_created` | New vault created successfully (with btc_amount_sats) | `screens/vaultCreation/VaultSuccessScreen.tsx` |
| `vault_operation_completed` | Vault deposit completed (with operation, amount_sats, unit) | `screens/deposit/DepositSuccessScreen.tsx` |
| `vault_operation_completed` | Vault borrow completed (with operation, amount, unit) | `screens/borrow/BorrowSuccessScreen.tsx` |
| `vault_operation_completed` | Vault repay completed (with operation, amount, unit) | `screens/repay/RepaySuccessScreen.tsx` |
| `vault_operation_completed` | Vault withdraw completed (with operation, amount_sats, unit) | `screens/withdraw/WithdrawSuccessScreen.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

**Dashboard:** https://eu.posthog.com/project/154717/dashboard/607466

**Insights:**
- [Onboarding Funnel](https://eu.posthog.com/project/154717/insights/hrHr8ha3) — conversion from app open → PIN setup → onboarding complete
- [Auth Success vs Failed](https://eu.posthog.com/project/154717/insights/tYSAvXqC) — daily PIN auth success/failure rates
- [Transactions Broadcast](https://eu.posthog.com/project/154717/insights/E0k5JT6w) — daily BTC/UNIT sends completed
- [Vault Activity](https://eu.posthog.com/project/154717/insights/JeAkJQqo) — vaults created and vault operations over time
- [Biometric Adoption](https://eu.posthog.com/project/154717/insights/VNICaPzv) — Face ID/Touch ID enable vs skip rate

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
