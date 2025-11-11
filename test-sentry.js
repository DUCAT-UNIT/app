/**
 * Test Sentry Integration
 * Run this to verify Sentry is working
 *
 * Usage:
 * 1. Temporarily add this to App.js: import './test-sentry';
 * 2. Check https://sentry.io for the test error
 * 3. Remove the import when done
 */

import * as Sentry from '@sentry/react-native';
import logger from './utils/logger';

// Force enable Sentry for testing
Sentry.init({
  dsn: 'https://73c5edc0813cd1be8eba194004f1ec1a@o4510347963072512.ingest.us.sentry.io/4510347966873600',
  environment: 'test',
  enabled: true, // Force enable
  tracesSampleRate: 1.0,
});

console.log('🧪 Testing Sentry...');

// Test 1: Direct Sentry error
Sentry.captureException(new Error('🧪 Sentry Test Error #1 - Direct capture'));

// Test 2: Logger error
logger.error(new Error('🧪 Sentry Test Error #2 - Via logger'), {
  testType: 'logger',
  timestamp: new Date().toISOString(),
});

// Test 3: Logger warning
logger.warn('🧪 Sentry Test Warning #3', {
  testType: 'warning',
});

// Test 4: Transaction breadcrumb
logger.transaction('test_transaction', {
  amount: 50000,
  testId: 'sentry-test',
});

// Test 5: Security event
logger.security('test_security_event', {
  eventType: 'sentry-test',
});

console.log('✅ Sentry test events sent!');
console.log('📊 Check your Sentry dashboard: https://sentry.io/organizations/YOUR_ORG/projects/');
console.log('⏱️  May take 10-30 seconds to appear');

setTimeout(() => {
  console.log('✅ Test complete. Remove import from App.js and restart.');
}, 2000);
