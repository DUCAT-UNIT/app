const { ethers } = require('hardhat');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const SEPOLIA_USDC = process.env.SEPOLIA_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const DEFAULT_A = 200;
const DEFAULT_SWAP_FEE_BPS = 4;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with ${deployer.address}`);

  const WUNIT = await ethers.getContractFactory('WUNIT');
  const wunit = await WUNIT.deploy(deployer.address);
  await wunit.waitForDeployment();

  const UnitUsdcStablePool = await ethers.getContractFactory('UnitUsdcStablePool');
  const pool = await UnitUsdcStablePool.deploy(
    deployer.address,
    await wunit.getAddress(),
    SEPOLIA_USDC,
    DEFAULT_A,
    DEFAULT_SWAP_FEE_BPS,
  );
  await pool.waitForDeployment();

  const UnitBridgeRouter = await ethers.getContractFactory('UnitBridgeRouter');
  const router = await UnitBridgeRouter.deploy(
    deployer.address,
    await wunit.getAddress(),
    SEPOLIA_USDC,
    await pool.getAddress(),
  );
  await router.waitForDeployment();

  const operatorRole = await wunit.OPERATOR_ROLE();
  await (await wunit.grantRole(operatorRole, await router.getAddress())).wait();

  const deployment = {
    network: 'sepolia',
    chainId: 11_155_111,
    deployer: deployer.address,
    wunit: await wunit.getAddress(),
    pool: await pool.getAddress(),
    router: await router.getAddress(),
    sepoliaUsdc: SEPOLIA_USDC,
    amplification: DEFAULT_A,
    swapFeeBps: DEFAULT_SWAP_FEE_BPS,
  };

  const outDir = join(__dirname, '..', 'deployments');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sepolia.json'), JSON.stringify(deployment, null, 2));

  console.log(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
