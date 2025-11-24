/**
 * Cashu Token Operations
 * Re-exports all token operations for backward compatibility
 */

// Mint operations
import {
  requestMint,
  checkMintStatus,
  completeMint,
} from './operations/cashuMintOperations';

// Receive token
import { receiveToken } from './operations/cashuReceiveToken';

// Send token
import { sendToken } from './operations/cashuSendToken';

// Melt operations
import {
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
} from './operations/cashuMeltOperations';

// P2PK send
import { sendP2PKToken } from './operations/cashuSendP2PK';

// P2PK receive
import { receiveP2PKToken } from './operations/cashuReceiveP2PK';

// Recover locked change
import { recoverLockedChange } from './operations/cashuRecoverLockedChange';

// Named exports
export {
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken,
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
  sendP2PKToken,
  receiveP2PKToken,
  recoverLockedChange,
};

// Default export for compatibility
export default {
  requestMint,
  checkMintStatus,
  completeMint,
  receiveToken,
  sendToken,
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
  sendP2PKToken,
  receiveP2PKToken,
  recoverLockedChange,
};
