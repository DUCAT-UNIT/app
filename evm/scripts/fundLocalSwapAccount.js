const { ethers } = require('hardhat');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const DEFAULT_USER_ETH = ethers.parseEther('10');
const DEFAULT_USER_TOKEN_GRANT = ethers.parseUnits('5000', 6);

async function main() {
  const recipient = process.env.LOCAL_SWAP_RECIPIENT?.trim();
  if (!recipient) {
    throw new Error('Set LOCAL_SWAP_RECIPIENT to the address that should receive local ETH, USDC, and wUNIT');
  }

  const deployment = JSON.parse(
    readFileSync(join(__dirname, '..', 'deployments', 'local-swap.json'), 'utf8'),
  );

  const [deployer] = await ethers.getSigners();
  const usdcAmount = process.env.LOCAL_SWAP_RECIPIENT_USDC
    ? ethers.parseUnits(process.env.LOCAL_SWAP_RECIPIENT_USDC, 6)
    : DEFAULT_USER_TOKEN_GRANT;
  const wunitAmount = process.env.LOCAL_SWAP_RECIPIENT_WUNIT
    ? ethers.parseUnits(process.env.LOCAL_SWAP_RECIPIENT_WUNIT, 6)
    : DEFAULT_USER_TOKEN_GRANT;
  const ethAmount = process.env.LOCAL_SWAP_RECIPIENT_ETH
    ? ethers.parseEther(process.env.LOCAL_SWAP_RECIPIENT_ETH)
    : DEFAULT_USER_ETH;

  const mockUsdc = await ethers.getContractAt('MockUSDC', deployment.mockUsdc);
  const wunit = await ethers.getContractAt('WUNIT', deployment.wunit);

  await (await mockUsdc.mint(recipient, usdcAmount)).wait();
  await (await wunit.mint(recipient, wunitAmount)).wait();
  await (await deployer.sendTransaction({ to: recipient, value: ethAmount })).wait();

  process.stdout.write(
    `${JSON.stringify({
      recipient,
      eth: ethers.formatEther(ethAmount),
      usdc: ethers.formatUnits(usdcAmount, 6),
      wunit: ethers.formatUnits(wunitAmount, 6),
    }, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
