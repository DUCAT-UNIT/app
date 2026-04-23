const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Sepolia wUNIT bridge + stable pool', function () {
  async function deployFixture() {
    const [owner, user, recipient] = await ethers.getSigners();

    const WUNIT = await ethers.getContractFactory('WUNIT');
    const wunit = await WUNIT.deploy(owner.address);
    await wunit.waitForDeployment();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const Pool = await ethers.getContractFactory('UnitUsdcStablePool');
    const pool = await Pool.deploy(owner.address, await wunit.getAddress(), await usdc.getAddress(), 200, 4);
    await pool.waitForDeployment();

    const Router = await ethers.getContractFactory('UnitBridgeRouter');
    const router = await Router.deploy(
      owner.address,
      await wunit.getAddress(),
      await usdc.getAddress(),
      await pool.getAddress(),
    );
    await router.waitForDeployment();

    const operatorRole = await wunit.OPERATOR_ROLE();
    await (await wunit.grantRole(operatorRole, await router.getAddress())).wait();

    await (await wunit.mint(owner.address, 1_000_000_000)).wait();
    await (await usdc.mint(owner.address, 1_000_000_000)).wait();
    await (await wunit.approve(await pool.getAddress(), 500_000_000)).wait();
    await (await usdc.approve(await pool.getAddress(), 500_000_000)).wait();
    await (await pool.addLiquidity([500_000_000, 500_000_000], 0, owner.address)).wait();

    return { owner, user, recipient, wunit, usdc, pool, router };
  }

  it('enforces mint and burn roles and pause semantics', async function () {
    const { user, wunit } = await deployFixture();

    await expect(wunit.connect(user).mint(user.address, 1)).to.be.reverted;

    await (await wunit.pause()).wait();
    await expect(wunit.transfer(user.address, 1)).to.be.revertedWithCustomError(wunit, 'EnforcedPause');
    await (await wunit.unpause()).wait();

    await (await wunit.mint(user.address, 10_000)).wait();
    await (await wunit.operatorBurn(user.address, 5_000)).wait();

    expect(await wunit.totalMinted()).to.equal(1_000_010_000n);
    expect(await wunit.totalBurned()).to.equal(5_000n);
  });

  it('mints LP, quotes stable swaps, and respects slippage guards', async function () {
    const { owner, pool, usdc, wunit } = await deployFixture();

    expect(await pool.totalSupply()).to.be.gt(0);

    const quoted = await pool.quoteSwap(0, 100_000);
    expect(quoted).to.be.gt(99_000);

    await (await wunit.approve(await pool.getAddress(), 100_000)).wait();
    await expect(pool.swap(0, 100_000, quoted + 1n, owner.address)).to.be.revertedWith('slippage');

    const usdcBefore = await usdc.balanceOf(owner.address);
    await (await pool.swap(0, 100_000, 99_000, owner.address)).wait();
    const usdcAfter = await usdc.balanceOf(owner.address);
    expect(usdcAfter - usdcBefore).to.be.gte(99_000);
  });

  it('fulfills auto-swap bridge deposits into USDC', async function () {
    const { recipient, router, usdc } = await deployFixture();

    const intentId = ethers.id('intent-1');
    const recipientUsdcBefore = await usdc.balanceOf(recipient.address);
    await (await router.fulfillBridge(intentId, recipient.address, 200_000, true, 199_000)).wait();
    const recipientUsdcAfter = await usdc.balanceOf(recipient.address);

    expect(recipientUsdcAfter - recipientUsdcBefore).to.be.gte(199_000);
  });

  it('falls back to raw wUNIT when auto-swap cannot execute', async function () {
    const { recipient, router, pool, wunit } = await deployFixture();

    await (await pool.pause()).wait();
    const intentId = ethers.id('intent-2');
    await (await router.fulfillBridge(intentId, recipient.address, 75_000, true, 74_000)).wait();

    expect(await wunit.balanceOf(recipient.address)).to.equal(75_000);
  });

  it('burns wUNIT on redemption requests and emits release events', async function () {
    const { owner, user, router, wunit } = await deployFixture();

    await (await router.fulfillBridge(ethers.id('intent-3'), user.address, 50_000, false, 0)).wait();
    await (await wunit.connect(user).approve(await router.getAddress(), 50_000)).wait();

    await expect(
      router.connect(user).requestRedemption(ethers.id('release-1'), 50_000, 'tb1punitdestination'),
    )
      .to.emit(router, 'RedemptionRequested')
      .withArgs(ethers.id('release-1'), user.address, 'tb1punitdestination', 50_000, await wunit.getAddress());

    expect(await wunit.balanceOf(user.address)).to.equal(0);
    expect(await wunit.totalBurned()).to.be.gte(50_000);
    expect(await wunit.balanceOf(owner.address)).to.be.gt(0);
  });
});
