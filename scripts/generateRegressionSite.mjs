#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const defaults = {
  regression: 'artifacts/live-regression/testflight-no-usdc-build2-final.json',
  maestro: 'artifacts/live-maestro/testflight-no-usdc-build2-final.json',
  output: 'docs/regression/index.html',
};

const flowNotes = {
  'live-receive-btc-airdrop.yaml': {
    name: 'Receive BTC',
    summary:
      'Creates a fresh wallet, verifies a funded BTC balance, opens receive, and copies the receive address.',
    expectedProofs: '1 receive funding proof',
  },
  'live-send-btc.yaml': {
    name: 'Send BTC',
    summary:
      'Creates a funded wallet, enters a BTC address, max-sends, reviews, broadcasts, and copies the txid.',
    expectedProofs: '1 BTC send txid',
  },
  'live-send-btc-relaunch-pending.yaml': {
    name: 'BTC Relaunch Recovery',
    summary:
      'Broadcasts a BTC send, kills the app on the confirmation screen, relaunches, and verifies the pending send rehydrates.',
    expectedProofs: 'Pending BTC send panel plus 1 BTC send txid',
  },
  'live-send-unit.yaml': {
    name: 'Send UNIT',
    summary:
      'Imports the reviewer wallet, verifies UNIT balance, sends on-chain UNIT, and copies the txid.',
    expectedProofs: '1 UNIT send txid',
  },
  'live-send-unit-relaunch-pending.yaml': {
    name: 'UNIT Relaunch Recovery',
    summary:
      'Broadcasts an on-chain UNIT send, kills the app on the confirmation screen, relaunches, and verifies the pending send rehydrates.',
    expectedProofs: 'Pending UNIT send panel plus 1 UNIT send txid',
  },
  'live-vault-actions.yaml': {
    name: 'Vault Actions',
    summary:
      'Opens a live vault, deposits collateral, borrows UNIT, repays UNIT, and withdraws collateral.',
    expectedProofs: '5 vault action checkpoints; raw txids can be 8+',
  },
  'live-vault-open-relaunch-pending.yaml': {
    name: 'Vault Open Relaunch Recovery',
    summary:
      'Submits a vault open, kills the app on success, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault open lock and vault checkpoint',
  },
  'live-vault-deposit-relaunch-pending.yaml': {
    name: 'Vault Deposit Relaunch Recovery',
    summary:
      'Submits a vault deposit, kills the app on success, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault deposit lock and vault checkpoint',
  },
  'live-vault-borrow-relaunch-pending.yaml': {
    name: 'Vault Borrow Relaunch Recovery',
    summary:
      'Submits an on-chain UNIT borrow, kills the app on success, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault borrow lock and vault checkpoint',
  },
  'live-vault-borrow-turbounit.yaml': {
    name: 'Borrow TurboUNIT',
    summary:
      'Borrows from the reviewer vault, selects TurboUNIT payout, and mints the issued UNIT into TurboUNIT.',
    expectedProofs: 'Borrow txids plus TurboUNIT mint settlement',
  },
  'live-vault-open-turbounit-relaunch-pending.yaml': {
    name: 'Open TurboUNIT Relaunch Recovery',
    summary:
      'Opens a vault with TurboUNIT payout, kills the app on success, relaunches, and verifies recovery state.',
    expectedProofs: 'Pending vault open lock plus TurboUNIT settlement checkpoint',
  },
  'live-vault-borrow-turbounit-relaunch-pending.yaml': {
    name: 'Borrow TurboUNIT Relaunch Recovery',
    summary:
      'Borrows with TurboUNIT payout, kills the app on success, relaunches, and verifies recovery state.',
    expectedProofs: 'Pending vault borrow lock plus TurboUNIT settlement checkpoint',
  },
  'live-vault-turbounit-repay.yaml': {
    name: 'Repay TurboUNIT',
    summary:
      'Creates TurboUNIT, selects the TurboUNIT funding card, and repays the vault through the live path.',
    expectedProofs: 'TurboUNIT funding plus repay txids',
  },
  'live-vault-repay-turbounit-relaunch-pending.yaml': {
    name: 'Repay TurboUNIT Relaunch Recovery',
    summary:
      'Repays with TurboUNIT funding, kills the app on success, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault repay lock plus TurboUNIT melt checkpoint',
  },
  'live-vault-second-repay.yaml': {
    name: 'Second Repay',
    summary:
      'Runs two consecutive UNIT repayments against the same vault and verifies the second one does not hang.',
    expectedProofs: '2 consecutive repay checkpoints',
  },
  'live-vault-repay-relaunch-pending.yaml': {
    name: 'Vault Repay Relaunch Recovery',
    summary:
      'Submits a real vault repay, kills the app on the success screen, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault lock, recovery panel, and repay checkpoint',
  },
  'live-vault-withdraw-relaunch-pending.yaml': {
    name: 'Vault Withdraw Relaunch Recovery',
    summary:
      'Submits a vault withdrawal, kills the app on success, relaunches, and verifies the pending vault lock rehydrates and clears.',
    expectedProofs: 'Pending vault withdraw lock and vault checkpoint',
  },
};

function parseArgs(argv) {
  const result = { ...defaults };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--regression') {
      result.regression = argv[index + 1] || result.regression;
      index += 1;
    } else if (arg === '--maestro') {
      result.maestro = argv[index + 1] || result.maestro;
      index += 1;
    } else if (arg === '--output') {
      result.output = argv[index + 1] || result.output;
      index += 1;
    }
  }

  return result;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return 'n/a';
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatDate(value) {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function formatEvidence(events = []) {
  if (events.length === 0) {
    return 'Not recorded';
  }

  return events
    .map((event) =>
      event
        .replace('clipboard_txid', 'Clipboard txid')
        .replace('simulator_pending_store:', 'Pending store: ')
        .replaceAll('_', ' ')
    )
    .join(', ');
}

function shortTxid(txid) {
  return `${txid.slice(0, 10)}...${txid.slice(-10)}`;
}

function pct(value, max) {
  if (!max) {
    return 0;
  }

  return Math.max(8, Math.round((value / max) * 100));
}

function flowPassed(flow) {
  if (!flow || typeof flow !== 'object') {
    return false;
  }

  if (flow.result !== undefined) {
    return flow.result === 'passed';
  }

  if (typeof flow.passed === 'boolean') {
    return flow.passed === true && (flow.status === undefined || flow.status === 0);
  }

  return flow.status === 0;
}

function flowStatusLabel(flow) {
  if (flowPassed(flow)) {
    return 'PASS';
  }

  if (
    !flow ||
    (flow.result === undefined && flow.passed === undefined && flow.status === undefined)
  ) {
    return 'UNKNOWN';
  }

  return 'FAIL';
}

function renderFlowRows(flows) {
  const maxDuration = Math.max(...flows.map((flow) => flow.durationMs || 0), 1);

  return flows
    .map((flow) => {
      const filename = basename(flow.flow);
      const note = flowNotes[filename] || {
        name: filename.replace('.yaml', ''),
        summary: flow.flow,
        expectedProofs: 'Flow-specific proof not annotated',
      };
      const passed = flowPassed(flow);
      const status = flowStatusLabel(flow);
      const statusClass = passed ? 'pass' : 'fail';
      const width = pct(flow.durationMs || 0, maxDuration);

      return `<tr>
        <td data-label="Flow">
          <strong>${escapeHtml(note.name)}</strong>
          <span>${escapeHtml(note.summary)}</span>
        </td>
        <td data-label="Status"><span class="status ${statusClass}">${status}</span></td>
        <td data-label="Duration" class="duration">${escapeHtml(formatDuration(flow.durationMs))}</td>
        <td data-label="Expected Proofs">${escapeHtml(note.expectedProofs)}</td>
        <td data-label="Relative">
          <div class="bar" aria-label="${escapeHtml(note.name)} duration">
            <span style="width: ${width}%"></span>
          </div>
        </td>
        <td data-label="Source"><code>${escapeHtml(filename)}</code></td>
      </tr>`;
    })
    .join('\n');
}

function renderTxRows(results) {
  return results
    .map((result) => {
      const status = result.confirmed ? 'CONFIRMED' : 'PENDING';
      const statusClass = result.confirmed ? 'pass' : 'warn';
      const txUrl = `https://mutinynet.com/tx/${result.txid}`;

      return `<tr>
        <td data-label="Txid">
          <a href="${escapeHtml(txUrl)}" target="_blank" rel="noreferrer">${escapeHtml(shortTxid(result.txid))}</a>
          <button class="copy" type="button" data-copy="${escapeHtml(result.txid)}">Copy</button>
        </td>
        <td data-label="Status"><span class="status ${statusClass}">${status}</span></td>
        <td data-label="Block">${escapeHtml(result.status?.block_height ?? 'n/a')}</td>
        <td data-label="Evidence">${escapeHtml(formatEvidence(result.events))}</td>
        <td data-label="Lookup" class="duration">${escapeHtml(formatDuration(result.durationMs))}</td>
      </tr>`;
    })
    .join('\n');
}

function renderFixtureRows(checks = []) {
  if (checks.length === 0) {
    return '<tr><td colspan="4">No fixture checks were recorded.</td></tr>';
  }

  return checks
    .map((check) => {
      const status = check.passed ? 'PASS' : 'FAIL';
      const statusClass = check.passed ? 'pass' : 'fail';
      const primary =
        check.totalSats ??
        check.availableVaults ??
        (check.reserves ? `USDC ${check.reserves.usdc} / wUNIT ${check.reserves.wunit}` : 'n/a');
      const details = Array.isArray(check.addresses)
        ? check.addresses.map((item) => `${item.utxos} UTXOs / ${item.sats} sats`).join(', ')
        : check.feed
          ? `claimable ${check.feed.claimableCount}, raw ${check.feed.rawCount}, terminal ${check.feed.terminalActionCount}, expired ${check.feed.expiredQuoteCount}`
          : check.error || 'n/a';

      return `<tr>
        <td data-label="Check">${escapeHtml(check.id)}</td>
        <td data-label="Status"><span class="status ${statusClass}">${status}</span></td>
        <td data-label="Primary">${escapeHtml(primary)}</td>
        <td data-label="Details">${escapeHtml(details)}</td>
      </tr>`;
    })
    .join('\n');
}

function buildHtml({ appJson, regression, maestro, paths }) {
  const version = appJson.expo?.version || 'unknown';
  const build = appJson.expo?.ios?.buildNumber || 'unknown';
  const txResults = regression.chainVerification?.results || [];
  const confirmedCount = txResults.filter((result) => result.confirmed).length;
  const maestroFlows = maestro.flows || [];
  const passedFlowCount = maestroFlows.filter(flowPassed).length;
  const allMaestroFlowsPassed = maestroFlows.length > 0 && passedFlowCount === maestroFlows.length;
  const flowRows = renderFlowRows(maestroFlows);
  const txRows = renderTxRows(txResults);
  const fixtureRows = renderFixtureRows(regression.fixtureVerification?.checks);
  const resultClass =
    regression.result === 'passed' && maestro.result === 'passed' && allMaestroFlowsPassed
      ? 'pass'
      : 'fail';
  const activeAtExit = regression.activeAtExit || [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ducat Regression Report</title>
  <style>
    :root {
      --bg: #101115;
      --panel: #191b21;
      --panel-2: #20232b;
      --text: #f2f4f8;
      --muted: #a5adba;
      --soft: #d5dae2;
      --border: #30343d;
      --success: #69c49a;
      --danger: #e36b7f;
      --warn: #e0b55a;
      --blue: #68a6ff;
      --orange: #f7931a;
      --radius: 8px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      color-scheme: dark;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
    }

    a {
      color: var(--blue);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      color: var(--soft);
      font-size: 12px;
      word-break: break-word;
    }

    .shell {
      width: min(1320px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }

    .top {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) auto;
      gap: 20px;
      align-items: end;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .eyebrow {
      margin: 0 0 8px;
      color: var(--orange);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    h1,
    h2,
    p {
      margin-top: 0;
    }

    h1 {
      margin-bottom: 8px;
      font-size: clamp(30px, 4vw, 52px);
      line-height: 1.02;
      letter-spacing: 0;
    }

    .subtitle {
      max-width: 860px;
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .result-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 132px;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--panel);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 20px 0;
    }

    .metric,
    .section {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--panel);
    }

    .metric {
      padding: 16px;
      min-height: 112px;
    }

    .label {
      margin-bottom: 10px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .value {
      font-size: 28px;
      font-weight: 800;
      line-height: 1.05;
      word-break: break-word;
    }

    .detail {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .section {
      margin-top: 16px;
      overflow: hidden;
    }

    .section-head {
      display: flex;
      gap: 12px;
      align-items: baseline;
      justify-content: space-between;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-2);
    }

    h2 {
      margin-bottom: 0;
      font-size: 18px;
      letter-spacing: 0;
    }

    .section-head span {
      color: var(--muted);
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    td span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .status {
      display: inline-flex;
      width: fit-content;
      margin: 0;
      padding: 5px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .pass {
      color: var(--success);
      background: rgba(105, 196, 154, 0.1);
      border-color: rgba(105, 196, 154, 0.45);
    }

    .fail {
      color: var(--danger);
      background: rgba(227, 107, 127, 0.1);
      border-color: rgba(227, 107, 127, 0.45);
    }

    .warn {
      color: var(--warn);
      background: rgba(224, 181, 90, 0.1);
      border-color: rgba(224, 181, 90, 0.45);
    }

    .duration {
      white-space: nowrap;
      font-weight: 700;
    }

    .bar {
      width: 180px;
      height: 10px;
      border-radius: 999px;
      background: #2a2d35;
      overflow: hidden;
    }

    .bar span {
      display: block;
      height: 100%;
      margin: 0;
      background: var(--blue);
    }

    .copy {
      margin-left: 8px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--panel-2);
      color: var(--soft);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }

    .copy:hover {
      border-color: var(--blue);
    }

    .commands {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 16px 18px;
    }

    .command {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #121318;
    }

    .command strong {
      display: block;
      margin-bottom: 8px;
    }

    .command code {
      display: block;
      line-height: 1.45;
    }

    .notice {
      padding: 16px 18px;
      color: var(--soft);
      line-height: 1.55;
    }

    .notice strong {
      color: var(--text);
    }

    @media (max-width: 920px) {
      .top {
        grid-template-columns: 1fr;
      }

      .grid,
      .commands {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .section-head {
        align-items: flex-start;
        flex-direction: column;
      }

      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
      }

      thead {
        display: none;
      }

      tr {
        padding: 12px 18px;
        border-bottom: 1px solid var(--border);
      }

      td {
        display: grid;
        grid-template-columns: minmax(92px, 0.34fr) minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 0;
      }

      td::before {
        content: attr(data-label);
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }

      td[data-label='Flow'],
      td[data-label='Txid'],
      td[data-label='Check'] {
        display: block;
      }

      td[data-label='Flow']::before,
      td[data-label='Txid']::before,
      td[data-label='Check']::before {
        display: block;
        margin-bottom: 8px;
      }

      .bar {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="top">
      <div>
        <p class="eyebrow">Ducat live regression</p>
        <h1>Build ${escapeHtml(version)} (${escapeHtml(build)})</h1>
        <p class="subtitle">User-facing no-USDC release gate against the TestFlight reviewer wallet on Mutinynet. The page is generated from the Maestro report and live chain-confirmation report.</p>
      </div>
      <div class="result-pill ${resultClass}">${escapeHtml(regression.result.toUpperCase())}</div>
    </header>

    <section class="grid" aria-label="Run summary">
      <div class="metric">
        <div class="label">Total Runtime</div>
        <div class="value">${escapeHtml(formatDuration(regression.durationMs))}</div>
        <div class="detail">Started ${escapeHtml(formatDate(regression.startedAt))}</div>
      </div>
      <div class="metric">
        <div class="label">Flows</div>
        <div class="value">${escapeHtml(passedFlowCount)}/${escapeHtml(maestroFlows.length)}</div>
        <div class="detail">${
          allMaestroFlowsPassed
            ? 'All selected live flows passed.'
            : 'One or more selected live flows failed or did not report a status.'
        }</div>
      </div>
      <div class="metric">
        <div class="label">Confirmed Txids</div>
        <div class="value">${escapeHtml(confirmedCount)}/${escapeHtml(txResults.length)}</div>
        <div class="detail">Mutinynet confirmation required.</div>
      </div>
      <div class="metric">
        <div class="label">Exit State</div>
        <div class="value">${escapeHtml(activeAtExit.length === 0 ? 'Clean' : `${activeAtExit.length} Active`)}</div>
        <div class="detail">${escapeHtml(activeAtExit.length === 0 ? 'No active stuck phases at exit.' : activeAtExit.join(', '))}</div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Flow Timings</h2>
        <span>${escapeHtml(maestro.appId)} / ${escapeHtml(maestro.environment?.appNetwork || 'unknown')}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Flow</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Expected Proofs</th>
            <th>Relative</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${flowRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Confirmed Transactions</h2>
        <span>${escapeHtml(regression.chainVerification?.esploraApiUrl || 'chain verification')}</span>
      </div>
      <div class="notice">
        <strong>Capture scope:</strong> these txids are aggregate run evidence from clipboard and simulator pending storage.
        They are not yet attributed to individual substeps inside <code>live-vault-actions.yaml</code>. The vault-actions
        flow has five user-facing checkpoints: open, deposit, borrow, repay, and withdraw. Raw chain txids can be higher
        because open, borrow, and repay may each emit both an account/UNIT txid and a vault txid.
      </div>
      <table>
        <thead>
          <tr>
            <th>Txid</th>
            <th>Status</th>
            <th>Block</th>
            <th>Evidence</th>
            <th>Lookup</th>
          </tr>
        </thead>
        <tbody>
          ${txRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Fixture Checks</h2>
        <span>Reviewer wallet readiness</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Primary</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${fixtureRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Artifacts And Commands</h2>
        <span>Local paths are relative to the repo root</span>
      </div>
      <div class="commands">
        <div class="command">
          <strong>Regression JSON</strong>
          <code>${escapeHtml(paths.regression)}</code>
        </div>
        <div class="command">
          <strong>Maestro JSON</strong>
          <code>${escapeHtml(paths.maestro)}</code>
        </div>
        <div class="command">
          <strong>Run the gate</strong>
          <code>npm run e2e:real:no-usdc</code>
        </div>
        <div class="command">
          <strong>Regenerate this page</strong>
          <code>npm run regression:site</code>
        </div>
      </div>
    </section>
  </main>

  <script>
    document.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.getAttribute('data-copy');
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = 'Copied';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 1200);
        } catch {
          button.textContent = 'Copy failed';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 1200);
        }
      });
    });
  </script>
</body>
</html>`;
}

const paths = parseArgs(process.argv.slice(2));
const appJson = readJson('app.json');
const regression = readJson(paths.regression);
const maestro = readJson(paths.maestro);
const outputPath = resolve(root, paths.output);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildHtml({ appJson, regression, maestro, paths }));
console.log(`Regression site written to ${paths.output}`);
