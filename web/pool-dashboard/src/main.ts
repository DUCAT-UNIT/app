import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits, getAddress, isAddress, parseUnits } from 'ethers';
import './styles.css';

type DashboardStatus = 'ready' | 'degraded' | 'unconfigured' | 'error';
type HealthStatus = 'ok' | 'warning' | 'error';

interface Readiness {
  sepoliaRpc: boolean;
  bridgeApi: boolean;
  usdc: boolean;
  wunit: boolean;
  stablePool: boolean;
  bridgeRouter: boolean;
  poolContracts: boolean;
  bridgeContracts: boolean;
}

interface QuoteSample {
  amountIn: string;
  unitToUsdcOut: string;
  unitToUsdcImpactBps: number;
  usdcToUnitOut: string;
  usdcToUnitImpactBps: number;
}

interface WalletState {
  address: string;
  eth: string;
  usdc: string;
  wunit: string;
  stablePoolUsdcAllowance: string;
  stablePoolWunitAllowance: string;
  bridgeRouterWunitAllowance: string;
  canSwapUsdcSample: boolean;
  canSwapUnitSample: boolean;
  canRedeemUnitSample: boolean;
}

interface Dashboard {
  checkedAt: number;
  status: DashboardStatus;
  readiness: Readiness;
  contracts: {
    usdcAddress: string;
    wunitAddress: string;
    stablePoolAddress: string;
    bridgeRouterAddress: string;
  };
  reserves: { usdc: string; wunit: string } | null;
  impliedUnitPriceUsdc: string | null;
  imbalanceBps: number | null;
  maxInputAmount: string | null;
  quoteSamples: QuoteSample[];
  wallet: WalletState | null;
  error: string | null;
}

interface Snapshot extends Omit<Dashboard, 'wallet'> {
  id: string;
  walletAddress: string | null;
}

const DECIMALS = 6;
const SEPOLIA_USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const SNAPSHOT_KEY = 'ducat:pool-dashboard:snapshots:v1';
const SAMPLE_AMOUNTS = ['1', '10', '100'];
const REFRESH_TIMEOUT_MS = 15_000;

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const POOL_ABI = [
  'function quoteSwap(uint8 tokenIn, uint256 amountIn) view returns (uint256)',
  'function getBalances() view returns (uint256[2])',
];

declare global {
  interface ImportMeta {
    readonly env: Record<string, string | boolean | undefined>;
  }
}

const env = import.meta.env;

const config = {
  rpcUrl: readEnv('EXPO_PUBLIC_SEPOLIA_RPC_URL', 'VITE_SEPOLIA_RPC_URL'),
  bridgeApiBaseUrl: readEnv('EXPO_PUBLIC_UNIT_BRIDGE_API_URL', 'VITE_UNIT_BRIDGE_API_URL'),
  usdcAddress: readEnv('EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS', 'VITE_SEPOLIA_USDC_ADDRESS') || SEPOLIA_USDC_ADDRESS,
  wunitAddress: readEnv('EXPO_PUBLIC_WUNIT_ADDRESS', 'VITE_WUNIT_ADDRESS'),
  bridgeRouterAddress: readEnv('EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS', 'VITE_UNIT_BRIDGE_ROUTER_ADDRESS'),
  stablePoolAddress: readEnv('EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS', 'VITE_UNIT_USDC_STABLE_POOL_ADDRESS'),
  walletAddress: readEnv('VITE_POOL_DASHBOARD_WALLET_ADDRESS', 'EXPO_PUBLIC_POOL_DASHBOARD_WALLET_ADDRESS'),
  privateKey: readEnv('VITE_POOL_DASHBOARD_PRIVATE_KEY'),
};

const appRoot = getAppRoot();

let state: {
  dashboard: Dashboard | null;
  loading: boolean;
  refreshError: string | null;
  snapshots: Snapshot[];
} = {
  dashboard: null,
  loading: false,
  refreshError: null,
  snapshots: loadSnapshots(),
};

function readEnv(...names: string[]): string {
  for (const name of names) {
    const value = env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('Missing #app root');
  return root;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function readiness(): Readiness {
  const sepoliaRpc = isHttpUrl(config.rpcUrl);
  const bridgeApi = isHttpUrl(config.bridgeApiBaseUrl);
  const usdc = isAddress(config.usdcAddress);
  const wunit = isAddress(config.wunitAddress);
  const stablePool = isAddress(config.stablePoolAddress);
  const bridgeRouter = isAddress(config.bridgeRouterAddress);
  const poolContracts = sepoliaRpc && usdc && wunit && stablePool;

  return {
    sepoliaRpc,
    bridgeApi,
    usdc,
    wunit,
    stablePool,
    bridgeRouter,
    poolContracts,
    bridgeContracts: poolContracts && bridgeApi && bridgeRouter,
  };
}

function contracts(): Dashboard['contracts'] {
  return {
    usdcAddress: config.usdcAddress,
    wunitAddress: config.wunitAddress,
    stablePoolAddress: config.stablePoolAddress,
    bridgeRouterAddress: config.bridgeRouterAddress,
  };
}

function formatDashboardNumber(value: number, decimals = 6): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

function calculateQuoteImpactBps(amountInUnits: bigint, amountOutUnits: bigint): number {
  if (amountInUnits <= 0n) return 0;
  return Number(((amountInUnits - amountOutUnits) * 10_000n) / amountInUnits);
}

function calculateImbalanceBps(reserveWunit: bigint, reserveUsdc: bigint): number {
  const total = reserveWunit + reserveUsdc;
  if (total <= 0n) return 0;
  return Number(((reserveUsdc - reserveWunit) * 10_000n) / total);
}

function calculateImpliedUnitPriceUsdc(reserveWunit: bigint, reserveUsdc: bigint): string | null {
  if (reserveWunit <= 0n) return null;
  return formatDashboardNumber(Number(formatUnits(reserveUsdc, DECIMALS)) / Number(formatUnits(reserveWunit, DECIMALS)), 6);
}

function getConfiguredWalletAddress(): string | null {
  if (config.privateKey) {
    try {
      return new Wallet(config.privateKey).address;
    } catch {
      return null;
    }
  }
  if (config.walletAddress && isAddress(config.walletAddress)) return getAddress(config.walletAddress);
  return null;
}

function errorDashboard(message: string): Dashboard {
  return {
    checkedAt: Date.now(),
    status: 'error',
    readiness: readiness(),
    contracts: contracts(),
    reserves: null,
    impliedUnitPriceUsdc: null,
    imbalanceBps: null,
    maxInputAmount: null,
    quoteSamples: [],
    wallet: null,
    error: message,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

async function getDashboard(): Promise<Dashboard> {
  const checkedAt = Date.now();
  const ready = readiness();
  const contractAddresses = contracts();

  if (!ready.poolContracts) {
    return {
      checkedAt,
      status: 'unconfigured',
      readiness: ready,
      contracts: contractAddresses,
      reserves: null,
      impliedUnitPriceUsdc: null,
      imbalanceBps: null,
      maxInputAmount: null,
      quoteSamples: [],
      wallet: null,
      error: 'Sepolia RPC, USDC, wUNIT, and stable pool contracts must be configured to read the UNIT/USDC pool.',
    };
  }

  try {
    const provider = new JsonRpcProvider(config.rpcUrl, 11155111);
    const pool = new Contract(config.stablePoolAddress, POOL_ABI, provider);
    const balances = (await pool.getBalances()) as bigint[];
    const reserveWunit = balances[0] ?? 0n;
    const reserveUsdc = balances[1] ?? 0n;

    const quoteSamples = await Promise.all(SAMPLE_AMOUNTS.map(async (amountIn) => {
      const amountInUnits = parseUnits(amountIn, DECIMALS);
      const [unitToUsdcOut, usdcToUnitOut] = await Promise.all([
        pool.quoteSwap(0, amountInUnits) as Promise<bigint>,
        pool.quoteSwap(1, amountInUnits) as Promise<bigint>,
      ]);

      return {
        amountIn,
        unitToUsdcOut: formatUnits(unitToUsdcOut, DECIMALS),
        unitToUsdcImpactBps: calculateQuoteImpactBps(amountInUnits, unitToUsdcOut),
        usdcToUnitOut: formatUnits(usdcToUnitOut, DECIMALS),
        usdcToUnitImpactBps: calculateQuoteImpactBps(amountInUnits, usdcToUnitOut),
      };
    }));

    const walletAddress = getConfiguredWalletAddress();
    let wallet: WalletState | null = null;
    if (walletAddress) {
      const usdc = new Contract(config.usdcAddress, ERC20_ABI, provider);
      const wunit = new Contract(config.wunitAddress, ERC20_ABI, provider);
      const sampleUnits = parseUnits(SAMPLE_AMOUNTS[0], DECIMALS);
      const [
        ethBalance,
        usdcBalance,
        wunitBalance,
        stablePoolUsdcAllowance,
        stablePoolWunitAllowance,
        bridgeRouterWunitAllowance,
      ] = await Promise.all([
        provider.getBalance(walletAddress),
        usdc.balanceOf(walletAddress) as Promise<bigint>,
        wunit.balanceOf(walletAddress) as Promise<bigint>,
        usdc.allowance(walletAddress, config.stablePoolAddress) as Promise<bigint>,
        wunit.allowance(walletAddress, config.stablePoolAddress) as Promise<bigint>,
        ready.bridgeRouter ? wunit.allowance(walletAddress, config.bridgeRouterAddress) as Promise<bigint> : Promise.resolve(0n),
      ]);

      wallet = {
        address: walletAddress,
        eth: formatEther(ethBalance),
        usdc: formatUnits(usdcBalance, DECIMALS),
        wunit: formatUnits(wunitBalance, DECIMALS),
        stablePoolUsdcAllowance: formatUnits(stablePoolUsdcAllowance, DECIMALS),
        stablePoolWunitAllowance: formatUnits(stablePoolWunitAllowance, DECIMALS),
        bridgeRouterWunitAllowance: formatUnits(bridgeRouterWunitAllowance, DECIMALS),
        canSwapUsdcSample: usdcBalance >= sampleUnits && stablePoolUsdcAllowance >= sampleUnits,
        canSwapUnitSample: wunitBalance >= sampleUnits && stablePoolWunitAllowance >= sampleUnits,
        canRedeemUnitSample: wunitBalance >= sampleUnits && bridgeRouterWunitAllowance >= sampleUnits,
      };
    }

    return {
      checkedAt,
      status: ready.bridgeContracts ? 'ready' : 'degraded',
      readiness: ready,
      contracts: contractAddresses,
      reserves: {
        wunit: formatUnits(reserveWunit, DECIMALS),
        usdc: formatUnits(reserveUsdc, DECIMALS),
      },
      impliedUnitPriceUsdc: calculateImpliedUnitPriceUsdc(reserveWunit, reserveUsdc),
      imbalanceBps: calculateImbalanceBps(reserveWunit, reserveUsdc),
      maxInputAmount: formatUnits(reserveWunit < reserveUsdc ? reserveWunit : reserveUsdc, DECIMALS),
      quoteSamples,
      wallet,
      error: ready.bridgeContracts ? null : 'Pool is readable, but full bridge/redemption config is incomplete.',
    };
  } catch (error) {
    return {
      ...errorDashboard(error instanceof Error ? error.message : String(error)),
      checkedAt,
      readiness: ready,
      contracts: contractAddresses,
    };
  }
}

function loadSnapshots(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveSnapshot(dashboard: Dashboard): Snapshot[] {
  const snapshot: Snapshot = {
    ...dashboard,
    id: `${dashboard.checkedAt}:${dashboard.status}`,
    walletAddress: dashboard.wallet?.address ?? null,
  };
  const next = [snapshot, ...state.snapshots].slice(0, 12);
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return next;
}

async function refresh(): Promise<void> {
  const previousDashboard = state.dashboard;
  state = { ...state, loading: true, refreshError: null };
  render();

  const dashboard = await withTimeout(
    getDashboard(),
    REFRESH_TIMEOUT_MS,
    `Pool refresh timed out after ${Math.round(REFRESH_TIMEOUT_MS / 1000)} seconds.`,
  ).catch((error) => errorDashboard(error instanceof Error ? error.message : String(error)));
  const snapshots = saveSnapshot(dashboard);
  const shouldKeepPrevious =
    dashboard.status === 'error'
    && previousDashboard !== null
    && previousDashboard.status !== 'error';
  state = {
    dashboard: shouldKeepPrevious ? previousDashboard : dashboard,
    loading: false,
    refreshError: dashboard.status === 'error' ? dashboard.error : null,
    snapshots,
  };
  render();
}

function h(tag: string, attrs: Record<string, string> = {}, children: string[] = []): string {
  const attrText = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join('');
  return `<${tag}${attrText}>${children.join('')}</${tag}>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(value: string | null | undefined, maxLength = 30): string {
  if (!value) return '-';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(timestamp));
}

function formatAge(timestamp: number | null | undefined): string {
  if (!timestamp) return '-';
  const ms = Date.now() - timestamp;
  if (ms < 1000) return 'just now';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

function formatBps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function field(label: string, value: string | number | boolean | null | undefined, tone = ''): string {
  return h('div', { class: `field ${tone}`.trim() }, [
    h('span', { class: 'field-label' }, [escapeHtml(label)]),
    h('span', { class: 'field-value' }, [escapeHtml(value ?? '-')]),
  ]);
}

function statusPill(label: string, status: DashboardStatus | HealthStatus | 'missing' | 'configured' | 'ready' | 'incomplete'): string {
  return h('span', { class: `pill pill-${status}` }, [escapeHtml(label)]);
}

function section(title: string, body: string, extraClass = ''): string {
  return h('section', { class: `panel ${extraClass}`.trim() }, [
    h('div', { class: 'panel-title' }, [escapeHtml(title)]),
    body,
  ]);
}

function readinessGrid(dashboard: Dashboard | null): string {
  const ready = dashboard?.readiness ?? readiness();
  const items: Array<[string, boolean]> = [
    ['Sepolia RPC', ready.sepoliaRpc],
    ['Bridge API', ready.bridgeApi],
    ['USDC', ready.usdc],
    ['wUNIT', ready.wunit],
    ['Stable pool', ready.stablePool],
    ['Bridge router', ready.bridgeRouter],
    ['Pool contracts', ready.poolContracts],
    ['Bridge contracts', ready.bridgeContracts],
  ];
  return h('div', { class: 'readiness-grid' }, items.map(([label, ok]) => h('div', { class: 'ready-card' }, [
    h('span', {}, [escapeHtml(label)]),
    statusPill(ok ? 'ready' : 'missing', ok ? 'ready' : 'missing'),
  ])));
}

function healthCards(dashboard: Dashboard | null): string {
  const recent = state.snapshots[0];
  const previous = state.snapshots[1];
  const drift = recent?.impliedUnitPriceUsdc && previous?.impliedUnitPriceUsdc
    ? Math.round(((Number(recent.impliedUnitPriceUsdc) - Number(previous.impliedUnitPriceUsdc)) / Number(previous.impliedUnitPriceUsdc)) * 10_000)
    : null;
  const cards: Array<{ label: string; status: HealthStatus; message: string }> = [
    {
      label: 'Quote freshness',
      status: !dashboard || state.refreshError ? 'error' : Date.now() - dashboard.checkedAt > 5 * 60_000 ? 'warning' : 'ok',
      message: state.refreshError || (dashboard ? `Last checked ${formatAge(dashboard.checkedAt)}` : 'No dashboard snapshot loaded'),
    },
    {
      label: 'Contract readiness',
      status: dashboard?.readiness.bridgeContracts ? 'ok' : dashboard?.readiness.poolContracts ? 'warning' : 'error',
      message: dashboard?.readiness.bridgeContracts
        ? 'Pool, tokens, router, RPC, and bridge API are configured.'
        : dashboard?.readiness.poolContracts
          ? 'Pool is readable; bridge API or router is incomplete.'
          : 'Pool contracts or Sepolia RPC are incomplete.',
    },
    {
      label: 'Wallet readiness',
      status: !dashboard?.wallet ? 'warning' : dashboard.wallet.canSwapUsdcSample && dashboard.wallet.canSwapUnitSample && dashboard.wallet.canRedeemUnitSample ? 'ok' : 'warning',
      message: dashboard?.wallet
        ? `1-unit checks: ${[
          dashboard.wallet.canSwapUsdcSample ? 'USDC swap' : null,
          dashboard.wallet.canSwapUnitSample ? 'UNIT swap' : null,
          dashboard.wallet.canRedeemUnitSample ? 'redeem' : null,
        ].filter(Boolean).join(', ') || 'blocked'}`
        : 'Configure a wallet address for balance and allowance checks.',
    },
    {
      label: 'Reserve drift',
      status: drift === null ? 'warning' : Math.abs(drift) > 100 ? 'warning' : 'ok',
      message: drift === null ? 'Need two browser snapshots.' : `Price drift since previous snapshot ${formatBps(drift)}.`,
    },
  ];

  return h('div', { class: 'health-grid' }, cards.map((card) => h('div', { class: `health-card health-${card.status}` }, [
    h('div', { class: 'health-head' }, [
      h('strong', {}, [escapeHtml(card.label)]),
      statusPill(card.status.toUpperCase(), card.status),
    ]),
    h('p', {}, [escapeHtml(card.message)]),
  ])));
}

function quoteTable(dashboard: Dashboard | null): string {
  if (!dashboard?.quoteSamples.length) return h('p', { class: 'empty' }, ['No quote samples loaded.']);
  return h('div', { class: 'table-wrap' }, [
    `<table><thead><tr><th>Input</th><th>UNIT -> USDC</th><th>Impact</th><th>USDC -> UNIT</th><th>Impact</th></tr></thead><tbody>${dashboard.quoteSamples.map((sample) => `
      <tr>
        <td>${escapeHtml(sample.amountIn)}</td>
        <td>${escapeHtml(sample.unitToUsdcOut)}</td>
        <td>${escapeHtml(formatBps(sample.unitToUsdcImpactBps))}</td>
        <td>${escapeHtml(sample.usdcToUnitOut)}</td>
        <td>${escapeHtml(formatBps(sample.usdcToUnitImpactBps))}</td>
      </tr>`).join('')}</tbody></table>`,
  ]);
}

function walletPanel(dashboard: Dashboard | null): string {
  if (!dashboard?.wallet) {
    return h('p', { class: 'empty' }, ['No wallet address/private key configured. Read-only pool diagnostics still work.']);
  }
  const wallet = dashboard.wallet;
  return h('div', { class: 'field-grid' }, [
    field('Sepolia address', truncate(wallet.address, 42)),
    field('ETH', wallet.eth),
    field('USDC', wallet.usdc),
    field('wUNIT', wallet.wunit),
    field('USDC pool allowance', wallet.stablePoolUsdcAllowance),
    field('wUNIT pool allowance', wallet.stablePoolWunitAllowance),
    field('wUNIT router allowance', wallet.bridgeRouterWunitAllowance),
    field('Can swap 1 USDC', wallet.canSwapUsdcSample ? 'yes' : 'no', wallet.canSwapUsdcSample ? 'good' : 'warn'),
    field('Can swap 1 UNIT', wallet.canSwapUnitSample ? 'yes' : 'no', wallet.canSwapUnitSample ? 'good' : 'warn'),
    field('Can redeem 1 UNIT', wallet.canRedeemUnitSample ? 'yes' : 'no', wallet.canRedeemUnitSample ? 'good' : 'warn'),
  ]);
}

function snapshotList(): string {
  if (!state.snapshots.length) return h('p', { class: 'empty' }, ['No recent browser snapshots yet.']);
  return h('div', { class: 'snapshot-list' }, state.snapshots.slice(0, 8).map((snapshot) => h('div', { class: 'snapshot-row' }, [
    h('div', {}, [
      h('strong', {}, [escapeHtml(formatTime(snapshot.checkedAt))]),
      h('span', { class: 'muted' }, [escapeHtml(` ${snapshot.status}`)]),
    ]),
    h('div', {}, [escapeHtml(snapshot.impliedUnitPriceUsdc ? `${snapshot.impliedUnitPriceUsdc} USDC` : snapshot.error || '-')]),
    h('small', {}, [escapeHtml(snapshot.reserves ? `U ${snapshot.reserves.wunit} / $ ${snapshot.reserves.usdc}` : snapshot.walletAddress || '-')]),
  ])));
}

function configWarnings(): string {
  const warnings: string[] = [];
  if (config.privateKey) warnings.push('Private key mode is enabled. Use only a local diagnostic key; browser env vars are bundled client-side.');
  if (!config.rpcUrl) warnings.push('Sepolia RPC is missing. Set EXPO_PUBLIC_SEPOLIA_RPC_URL or VITE_SEPOLIA_RPC_URL.');
  if (!config.stablePoolAddress || !config.wunitAddress) warnings.push('Pool contract addresses are missing. Set wUNIT and UNIT/USDC stable pool env vars.');
  if (!warnings.length) return '';
  return h('div', { class: 'warning-strip' }, warnings.map((warning) => h('span', {}, [escapeHtml(warning)])));
}

function render(): void {
  const dashboard = state.dashboard;
  const status = dashboard?.status ?? 'unconfigured';
  const contractRows = dashboard ? h('div', { class: 'address-list' }, [
    field('USDC', dashboard.contracts.usdcAddress || '-'),
    field('wUNIT', dashboard.contracts.wunitAddress || '-'),
    field('Pool', dashboard.contracts.stablePoolAddress || '-'),
    field('Router', dashboard.contracts.bridgeRouterAddress || '-'),
  ]) : '';

  appRoot.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Mutinynet app / Sepolia pool diagnostics</p>
          <h1>UNIT/USDC Stable Pool</h1>
          <p class="lede">A local web dashboard for the test bridge pool. This does not represent mainnet or production liquidity.</p>
        </div>
        <div class="hero-card">
          ${statusPill(status.toUpperCase(), status)}
          <span>Checked ${escapeHtml(formatTime(dashboard?.checkedAt))}</span>
          <button id="refresh" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Loading...' : 'Refresh pool'}</button>
        </div>
      </section>

      ${configWarnings()}

      <section class="metric-grid">
        <div class="metric"><span>USDC reserve</span><strong>${escapeHtml(dashboard?.reserves?.usdc ?? '-')}</strong></div>
        <div class="metric"><span>wUNIT reserve</span><strong>${escapeHtml(dashboard?.reserves?.wunit ?? '-')}</strong></div>
        <div class="metric"><span>Implied UNIT price</span><strong>${escapeHtml(dashboard?.impliedUnitPriceUsdc ? `${dashboard.impliedUnitPriceUsdc} USDC` : '-')}</strong></div>
        <div class="metric"><span>Pool imbalance</span><strong>${escapeHtml(formatBps(dashboard?.imbalanceBps))}</strong></div>
        <div class="metric"><span>Max input</span><strong>${escapeHtml(dashboard?.maxInputAmount ?? '-')}</strong></div>
      </section>

      ${section('Readiness', readinessGrid(dashboard))}
      ${section('Route Health', healthCards(dashboard))}
      ${section('Quote Samples', quoteTable(dashboard), 'wide')}
      ${section('Wallet / Allowance Readiness', walletPanel(dashboard))}
      ${section('Contracts', contractRows || h('p', { class: 'empty' }, ['No contract config loaded.']))}
      ${section('Recent Snapshot / Error State', `${dashboard?.error ? h('div', { class: 'error-box' }, [escapeHtml(dashboard.error)]) : ''}${snapshotList()}`, 'wide')}
    </main>
  `;

  document.querySelector<HTMLButtonElement>('#refresh')?.addEventListener('click', () => {
    refresh().catch((error) => {
      state = { ...state, loading: false, refreshError: error instanceof Error ? error.message : String(error) };
      render();
    });
  });
}

render();
refresh().catch((error) => {
  state = { ...state, loading: false, refreshError: error instanceof Error ? error.message : String(error) };
  render();
});
