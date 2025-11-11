# Sentry Error Monitoring Setup

## Quick Start

1. **Create a Sentry Account**
   - Go to https://sentry.io/signup/
   - Create a free account

2. **Create a React Native Project**
   - Click "Projects" → "Create Project"
   - Select "React Native" as the platform
   - Name it "Ducat Wallet"

3. **Get Your DSN**
   - After creating the project, copy your DSN (Data Source Name)
   - It looks like: `https://xxxxxxxxxxxxx@oxxxxx.ingest.sentry.io/xxxxxxx`

4. **Add DSN to App.js**
   - Open `App.js`
   - Find line 44: `dsn: 'YOUR_SENTRY_DSN_HERE'`
   - Replace with your actual DSN

5. **Test It Works**
   ```javascript
   // Add this temporarily to test
   import logger from './utils/logger';
   logger.error(new Error('Test error from Ducat Wallet'));
   ```

## Usage

Use the centralized logger instead of console.log:

```javascript
import logger from './utils/logger';

// Debug logs (dev only)
logger.debug('User opened wallet', { userId: 123 });

// Info logs
logger.info('Transaction created', { txid: 'abc123' });

// Warnings
logger.warn('Low balance', { balance: 1000 });

// Errors
try {
  await sendTransaction();
} catch (error) {
  logger.error(error, { context: 'sendTransaction' });
}

// Transaction breadcrumbs
logger.transaction('intent_created', { amount: 50000 });
logger.transaction('signed', { txid: 'abc123' });
logger.transaction('broadcast', { txid: 'abc123' });

// Security events
logger.security('pin_failed', { attempts: 3 });
logger.security('lockout_triggered', { duration: 1800 });
```

## What Gets Logged

### Development (__DEV__ = true)
- All logs go to console
- Nothing sent to Sentry
- Full debug visibility

### Production (__DEV__ = false)
- Errors → Sentry (full stack traces)
- Warnings → Sentry (as messages)
- Info/Debug → Breadcrumbs only (context for errors)
- Transaction flow → Breadcrumbs
- Security events → Breadcrumbs

## Privacy & Security

✅ **Safe to log:**
- Transaction IDs (txid)
- Block heights
- Fee amounts (in sats)
- Error messages
- Flow steps

❌ **Never log:**
- Mnemonic phrases
- Private keys
- PINs
- User addresses (can be pseudonymous)
- Personal information

The logger is configured to filter out sensitive headers and cookies automatically.

## Viewing Errors

1. Go to https://sentry.io
2. Select your "Ducat Wallet" project
3. View:
   - **Issues**: All errors grouped by type
   - **Performance**: Transaction tracing
   - **Breadcrumbs**: User flow leading to errors

## Benefits

- 📊 **Real-time error tracking** - Know immediately when users hit errors
- 🔍 **Full context** - See breadcrumbs (user actions) leading to error
- 📈 **Trends** - Track error frequency over time
- 🎯 **Stack traces** - Exact line number where error occurred
- 🔔 **Alerts** - Get notified of critical errors via email/Slack

---

**Remember**: Replace `YOUR_SENTRY_DSN_HERE` in `App.js` before deploying to production!
