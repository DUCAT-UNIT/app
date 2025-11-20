/**
 * Manual script to complete a mint for a specific quote ID
 * Usage: node complete-mint-manual.js
 */

// Import the cashu wallet service
const { checkMintStatus, completeMint } = require('./services/cashu/cashuWalletService');

const quoteId = '4e2ceef0dfbbba3a6534b0919f369c622694b6b88ce1b8283a8da6669d7920b2';
const amount = 921.43; // The amount that was being minted

async function completeManualMint() {
  try {
    console.log('Checking mint status for quote:', quoteId);

    // Check the status
    const status = await checkMintStatus(quoteId);
    console.log('Quote status:', status);

    if (status.paid) {
      console.log('Quote is PAID! Completing mint...');

      // Complete the mint
      const proofs = await completeMint(quoteId, amount);
      console.log('Mint completed successfully!');
      console.log('Received proofs:', proofs.length);
      console.log('Total amount:', proofs.reduce((sum, p) => sum + p.amount, 0));

    } else {
      console.log('Quote is not yet paid. Current state:', status.state);
    }

  } catch (error) {
    console.error('Error completing mint:', error);
    console.error('Error details:', error.message);
  }
}

completeManualMint();
