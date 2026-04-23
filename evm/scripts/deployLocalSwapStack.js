const { ethers } = require('hardhat');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const DEFAULT_A = 200;
const DEFAULT_SWAP_FEE_BPS = 4;
const DEFAULT_POOL_SEED = ethers.parseUnits('1000000', 6);
const DEFAULT_USER_ETH = ethers.parseEther('10');
const DEFAULT_USER_TOKEN_GRANT = ethers.parseUnits('5000', 6);

async function main() {
  const [deployer] = await ethers.getSigners();
  const recipient = process.env.LOCAL_SWAP_RECIPIENT?.trim();
  const seedAmount = process.env.LOCAL_SWAP_SEED_AMOUNT
    ? ethers.parseUnits(process.env.LOCAL_SWAP_SEED_AMOUNT, 6)
    : DEFAULT_POOL_SEED;

  const MockUSDC = await ethers.getContractFactory('MockUSDC');
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();

  const WUNIT = await ethers.getContractFactory('WUNIT');
  const wunit = await WUNIT.deploy(deployer.address);
  await wunit.waitForDeployment();

  const UnitUsdcStablePool = await ethers.getContractFactory('UnitUsdcStablePool');
  const pool = await UnitUsdcStablePool.deploy(
    deployer.address,
    await wunit.getAddress(),
    await mockUsdc.getAddress(),
    DEFAULT_A,
    DEFAULT_SWAP_FEE_BPS,
  );
  await pool.waitForDeployment();

  const UnitBridgeRouter = await ethers.getContractFactory('UnitBridgeRouter');
  const router = await UnitBridgeRouter.deploy(
    deployer.address,
    await wunit.getAddress(),
    await mockUsdc.getAddress(),
    await pool.getAddress(),
  );
  await router.waitForDeployment();

  const operatorRole = await wunit.OPERATOR_ROLE();
  await (await wunit.grantRole(operatorRole, await router.getAddress())).wait();

  await (await mockUsdc.mint(deployer.address, seedAmount)).wait();
  await (await wunit.mint(deployer.address, seedAmount)).wait();
  await (await mockUsdc.approve(await pool.getAddress(), seedAmount)).wait();
  await (await wunit.approve(await pool.getAddress(), seedAmount)).wait();
  await (await pool.addLiquidity([seedAmount, seedAmount], 0, deployer.address)).wait();

  if (recipient) {
    await (await mockUsdc.mint(recipient, DEFAULT_USER_TOKEN_GRANT)).wait();
    await (await wunit.mint(recipient, DEFAULT_USER_TOKEN_GRANT)).wait();
    await deployer.sendTransaction({
      to: recipient,
      value: DEFAULT_USER_ETH,
    });
  }

  const deployment = {
    network: 'localhost',
    chainId: 11_155_111,
    deployer: deployer.address,
    mockUsdc: await mockUsdc.getAddress(),
    wunit: await wunit.getAddress(),
    pool: await pool.getAddress(),
    router: await router.getAddress(),
    amplification: DEFAULT_A,
    swapFeeBps: DEFAULT_SWAP_FEE_BPS,
    poolSeedAmount: ethers.formatUnits(seedAmount, 6),
    fundedRecipient: recipient || null,
  };

  const outDir = join(__dirname, '..', 'deployments');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'local-swap.json'), JSON.stringify(deployment, null, 2));
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
