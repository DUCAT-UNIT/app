# Patches

This directory contains patches for npm packages that are applied automatically via `patch-package` during `npm install` (via the postinstall script).

## @ducat-unit+client-sdk+0.7.23.patch

**Issue:** Vault creation fails with "Issue Tx ID in request does not match computed Issue Tx ID" error.

**Root Cause:** The SDK's `dist/util/runes.js` uses ESM syntax to import from `@ducat-unit/runestone` (a CommonJS package):

```javascript
import { encodeRunestone } from '@ducat-unit/runestone';
```

Metro bundler (React Native) doesn't correctly resolve this ESM-from-CommonJS import pattern, causing `encodeRunestone` to malfunction silently. This results in an empty runestone (`6a5d00`) being encoded instead of the proper runestone with edict data.

**The Fix:** Change the import to use CommonJS `require()`:

```javascript
const { encodeRunestone } = require('@ducat-unit/runestone');
```

**Symptoms before fix:**
- Vault creation fails at the guardian submission step
- Debug logs show: `PSBT 1 ORIGINAL OP_RETURN: 6a5d00` (empty runestone)
- Should show something like: `6a5d09016f00...` (runestone with edict data)

**When to remove this patch:**
- When the SDK is updated to fix this issue upstream
- When Metro bundler improves ESM/CommonJS interop
- If switching to a different bundler that handles this correctly

## @ducat-unit+runestone+1.0.5.patch

**Issue:** Vault creation fails with "Issue Tx ID in request does not match computed Issue Tx ID" error.

**Root Cause:** The runestone library's `encipher()` method uses `Buffer.subarray()` to chunk the payload. In React Native with the `buffer` polyfill, `Buffer.subarray()` returns a **Uint8Array** instead of a proper **Buffer**.

When `script.compile()` checks `Buffer.isBuffer(chunk)`, it returns `false` for Uint8Array, causing the payload to be treated as an opcode (single byte) instead of data (pushdata + bytes). This results in the 9-byte runestone payload being written as a single `0x00` byte.

**The Fix:** Wrap `payload.subarray()` with `Buffer.from()` to ensure the chunk is a proper Buffer:

```javascript
// Before (broken in React Native):
stack.push(payload.subarray(i, i + MAX_SCRIPT_ELEMENT_SIZE));

// After (fixed):
stack.push(Buffer.from(payload.subarray(i, i + MAX_SCRIPT_ELEMENT_SIZE)));
```

**Symptoms before fix:**
- Debug logs show correct payload: `Payload hex: 00b89c5d0184b42302` (9 bytes)
- But final script is wrong: `Final compiled script hex: 6a5d00` (only 3 bytes)
- The `00` is the payload incorrectly coerced to a single opcode byte

**When to remove this patch:**
- When the runestone library fixes this for React Native compatibility
- When React Native's Buffer polyfill properly implements subarray() to return Buffer

## react-native-passkey+3.3.1.patch

[Existing patch - add description if needed]
