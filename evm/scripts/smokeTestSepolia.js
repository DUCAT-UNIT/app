const { ethers } = require('hardhat');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const DEPLOYMENT_PATH = join(__dirname, '..', 'deployments', 'sepolia.json');
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

function parseAmount(value) {
  return ethers.parseUnits(value, 6);
}

function toPercentFloor(value, bps) {
  return (value * BigInt(bps)) / 10_000n;
}

async function waitForIncrease(read, baseline, label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await read();
    if (current > baseline) {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`${label} did not increase after transaction confirmation`);
}

async function approveIfNeeded(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);
  if (allowance >= amount) {
    return;
  }

  await (await token.approve(spender, amount)).wait();
}

async function main() {
  if (!existsSync(DEPLOYMENT_PATH)) {
    throw new Error(`Missing deployment file at ${DEPLOYMENT_PATH}`);
  }

  const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8'));
  const bridgeAmount = parseAmount(process.env.SEPOLIA_SMOKE_BRIDGE_WUNIT || '1');
  const swapBackAmount = parseAmount(process.env.SEPOLIA_SMOKE_SWAPBACK_USDC || '0.5');
  const minBps = Number(process.env.SEPOLIA_SMOKE_MIN_BPS || '9800');

  const [deployer] = await ethers.getSigners();
  const wunit = await ethers.getContractAt('WUNIT', deployment.wunit);
  const pool = await ethers.getContractAt('UnitUsdcStablePool', deployment.pool);
  const router = await ethers.getContractAt('UnitBridgeRouter', deployment.router);
  const usdc = new ethers.Contract(deployment.sepoliaUsdc, ERC20_ABI, deployer);

  const beforeUsdc = await usdc.balanceOf(deployer.address);
  const beforeWunit = await wunit.balanceOf(deployer.address);
  const beforeBurned = await wunit.totalBurned();

  const previewUsdc = await router.previewAutoSwap(bridgeAmount);
  const minUsdcOut = toPercentFloor(previewUsdc, minBps);
  const intentId = ethers.id(`sepolia-smoke-intent-${Date.now()}`);

  const fulfillTx = await router.fulfillBridge(intentId, deployer.address, bridgeAmount, true, minUsdcOut);
  await fulfillTx.wait();

  const afterFulfillUsdc = await waitForIncrease(
    () => usdc.balanceOf(deployer.address),
    beforeUsdc,
    'USDC balance',
  );
  const usdcReceived = afterFulfillUsdc - beforeUsdc;

  const swapInput = swapBackAmount <= usdcReceived ? swapBackAmount : usdcReceived;
  const previewWunit = await pool.quoteSwap(1, swapInput);
  const minWunitOut = toPercentFloor(previewWunit, minBps);

  await approveIfNeeded(usdc, deployer.address, deployment.pool, swapInput);
  const swapTx = await pool.swap(1, swapInput, minWunitOut, deployer.address);
  await swapTx.wait();

  const afterSwapWunit = await waitForIncrease(
    () => wunit.balanceOf(deployer.address),
    beforeWunit,
    'wUNIT balance',
  );
  const wunitReceived = afterSwapWunit - beforeWunit;

  const redeemAmount = wunitReceived;
  await approveIfNeeded(wunit, deployer.address, deployment.router, redeemAmount);
  const releaseId = ethers.id(`sepolia-smoke-release-${Date.now()}`);
  const redemptionTx = await router.requestRedemption(releaseId, redeemAmount, 'tb1punitsepoliasmoketestdestination');
  await redemptionTx.wait();

  const afterRedemptionWunit = await wunit.balanceOf(deployer.address);
  const afterBurned = await waitForIncrease(
    () => wunit.totalBurned(),
    beforeBurned,
    'wUNIT burned total',
  );
  const [reserveWunit, reserveUsdc] = await pool.getBalances();

  console.log(JSON.stringify({
    deployer: deployer.address,
    bridge: {
      intentId,
      txHash: fulfillTx.hash,
      requestedWunit: ethers.formatUnits(bridgeAmount, 6),
      previewUsdc: ethers.formatUnits(previewUsdc, 6),
      receivedUsdc: ethers.formatUnits(usdcReceived, 6),
    },
    swap: {
      txHash: swapTx.hash,
      inputUsdc: ethers.formatUnits(swapInput, 6),
      previewWunit: ethers.formatUnits(previewWunit, 6),
      receivedWunit: ethers.formatUnits(wunitReceived, 6),
    },
    redemption: {
      releaseId,
      txHash: redemptionTx.hash,
      redeemedWunit: ethers.formatUnits(redeemAmount, 6),
      totalBurnedDelta: ethers.formatUnits(afterBurned - beforeBurned, 6),
      remainingWalletWunit: ethers.formatUnits(afterRedemptionWunit, 6),
    },
    poolReserves: {
      wunit: ethers.formatUnits(reserveWunit, 6),
      usdc: ethers.formatUnits(reserveUsdc, 6),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
