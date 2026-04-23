const { ethers } = require('hardhat');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const DEPLOYMENT_PATH = join(__dirname, '..', 'deployments', 'sepolia.json');
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function symbol() view returns (string)',
];

function parseAmount(value) {
  return ethers.parseUnits(value, 6);
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
  const seedUsdc = parseAmount(process.env.SEPOLIA_SEED_USDC || '20');
  const seedWunit = parseAmount(process.env.SEPOLIA_SEED_WUNIT || process.env.SEPOLIA_SEED_USDC || '20');

  const [deployer] = await ethers.getSigners();
  const wunit = await ethers.getContractAt('WUNIT', deployment.wunit);
  const pool = await ethers.getContractAt('UnitUsdcStablePool', deployment.pool);
  const usdc = new ethers.Contract(deployment.sepoliaUsdc, ERC20_ABI, deployer);

  const usdcBalance = await usdc.balanceOf(deployer.address);
  if (usdcBalance < seedUsdc) {
    throw new Error(`Insufficient USDC: have ${ethers.formatUnits(usdcBalance, 6)}, need ${ethers.formatUnits(seedUsdc, 6)}`);
  }

  const wunitBalance = await wunit.balanceOf(deployer.address);
  if (wunitBalance < seedWunit) {
    await (await wunit.mint(deployer.address, seedWunit - wunitBalance)).wait();
  }

  await approveIfNeeded(wunit, deployer.address, deployment.pool, seedWunit);
  await approveIfNeeded(usdc, deployer.address, deployment.pool, seedUsdc);

  const addTx = await pool.addLiquidity([seedWunit, seedUsdc], 0, deployer.address);
  await addTx.wait();

  const [reserveWunit, reserveUsdc, amplification, swapFeeBps, totalLpSupply, paused] = await pool.getPoolState();

  console.log(JSON.stringify({
    deployer: deployer.address,
    txHash: addTx.hash,
    seeded: {
      wunit: ethers.formatUnits(seedWunit, 6),
      usdc: ethers.formatUnits(seedUsdc, 6),
    },
    pool: {
      reserveWunit: ethers.formatUnits(reserveWunit, 6),
      reserveUsdc: ethers.formatUnits(reserveUsdc, 6),
      amplification: amplification.toString(),
      swapFeeBps: swapFeeBps.toString(),
      totalLpSupply: ethers.formatUnits(totalLpSupply, 18),
      paused,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
