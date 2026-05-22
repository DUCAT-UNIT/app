# Security Policy

DUCAT Wallet is a non-custodial wallet on Mutinynet. Even though the app is
testnet-only, vulnerabilities in key handling, authentication, signing, e-cash,
or vault flows should be treated as security issues.

## Supported Versions

Security fixes target the default branch and the latest TestFlight release line.

## Reporting A Vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting when available, or contact the
maintainers privately through the Ducat Protocol team channels. Include:

- Affected area and files, if known
- Steps to reproduce
- Impact assessment
- Any proof-of-concept details needed to verify the issue

We will confirm receipt, triage impact, and coordinate a fix before public
disclosure.

## High-Risk Areas

- Seed phrase, private key, PIN, passkey, and SecureStore handling
- PSBT validation and signing policy
- Cashu proof lifecycle and P2PK token handling
- Vault state, guardian messages, and liquidation execution
- Analytics, logs, notifications, QR payloads, and deep links
