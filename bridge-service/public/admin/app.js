const metricsEl = document.getElementById('metrics');
const poolStateEl = document.getElementById('poolState');
const intentsTableEl = document.getElementById('intentsTable');
const redemptionsTableEl = document.getElementById('redemptionsTable');
const serviceStatusEl = document.getElementById('serviceStatus');
const runtimeBadgeEl = document.getElementById('runtimeBadge');
const authBadgeEl = document.getElementById('authBadge');
const adminTokenButton = document.getElementById('adminTokenButton');
const bridgeToggleButton = document.getElementById('bridgeToggleButton');
const poolToggleButton = document.getElementById('poolToggleButton');

const TOKEN_STORAGE_KEY = 'unit-bridge-admin-token';

let bridgeHealth = null;
let adminToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || '';

function updateAuthUi() {
  const authEnabled = Boolean(bridgeHealth?.adminAuthEnabled);
  runtimeBadgeEl.textContent = bridgeHealth
    ? (bridgeHealth.liveRuntimeConfigured ? 'Live runtime configured' : bridgeHealth.liveMode ? 'Live mode incomplete' : 'POC simulation mode')
    : 'Checking runtime…';
  authBadgeEl.textContent = authEnabled
    ? adminToken ? 'Admin auth active' : 'Admin token required'
    : 'Admin auth disabled';
  adminTokenButton.textContent = adminToken ? 'Update token' : 'Admin token';
}

function setAdminToken(value) {
  adminToken = value.trim();
  if (adminToken) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, adminToken);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  updateAuthUi();
}

function promptForAdminToken(force = false) {
  if (!bridgeHealth?.adminAuthEnabled) {
    return;
  }

  if (!force && adminToken) {
    return;
  }

  const next = window.prompt('Enter UNIT bridge admin bearer token', adminToken);
  if (next === null) {
    return;
  }

  setAdminToken(next);
}

async function request(path, options = {}, allowAuthRetry = path !== '/health') {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401 && bridgeHealth?.adminAuthEnabled && allowAuthRetry) {
    setAdminToken('');
    if (bridgeHealth.adminUiTokenPrompt) {
      promptForAdminToken(true);
      if (adminToken) {
        return request(path, options, false);
      }
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function metricCard(label, value, note) {
  return `
    <article class="metric">
      <h3>${label}</h3>
      <div class="value">${value}</div>
      <div class="note">${note || ''}</div>
    </article>
  `;
}

function renderTable(rows, emptyText) {
  if (!rows.length) {
    return `<p>${emptyText}</p>`;
  }
  return `<table>${rows.join('')}</table>`;
}

function renderOverview(data) {
  const { reconciliation, pool, intents, redemptions, bridgePaused, poolPaused } = data;

  bridgeToggleButton.textContent = bridgePaused ? 'Resume bridge' : 'Pause bridge';
  poolToggleButton.textContent = poolPaused ? 'Resume pool' : 'Pause pool';

  metricsEl.innerHTML = [
    metricCard('Locked UNIT', reconciliation.lockedUnit, 'Protocol custody balance'),
    metricCard('Circulating wUNIT', reconciliation.circulatingWunit, 'Sepolia supply'),
    metricCard('Pending releases', reconciliation.pendingReleaseUnit, 'Waiting on Mutinynet execution'),
    metricCard('Backing drift', reconciliation.drift, reconciliation.isBacked ? 'Fully backed' : reconciliation.alert),
    metricCard('Pool wUNIT', pool.reserveWunit, 'Stable pool reserve'),
    metricCard('Pool USDC', pool.reserveUsdc, `A=${pool.amplification}, fee=${pool.swapFeeBps}bps`),
  ].join('');

  poolStateEl.textContent = JSON.stringify(pool, null, 2);

  intentsTableEl.innerHTML = renderTable(
    intents.map((intent) => `
      <tr>
        <td><strong>${intent.id}</strong><br /><small>${intent.depositAddress}</small></td>
        <td>${intent.amount}</td>
        <td><span class="pill ${intent.status === 'failed' ? 'failed' : ''}">${intent.status}</span></td>
        <td>${intent.payoutAsset || '-'}</td>
        <td>${intent.payoutAmount || '-'}</td>
      </tr>
    `),
    'No bridge intents yet.',
  );

  redemptionsTableEl.innerHTML = renderTable(
    redemptions.map((redemption) => `
      <tr>
        <td><strong>${redemption.id}</strong><br /><small>${redemption.destinationTaprootAddress}</small></td>
        <td>${redemption.amount}</td>
        <td><span class="pill ${redemption.status === 'failed' ? 'failed' : ''}">${redemption.status}</span></td>
        <td>${redemption.releaseTxid || '-'}</td>
      </tr>
    `),
    'No redemptions tracked yet.',
  );
}

function renderHealth(health) {
  bridgeHealth = health;
  updateAuthUi();
  serviceStatusEl.textContent = JSON.stringify(health, null, 2);
}

async function loadHealth() {
  renderHealth(await request('/health', {}, false));
}

async function refreshOverview() {
  const overview = await request('/admin/overview');
  renderOverview(overview);
}

document.getElementById('refreshButton').addEventListener('click', refreshOverview);
adminTokenButton.addEventListener('click', () => promptForAdminToken(true));

document.querySelectorAll('[data-liquidity]').forEach((button) => {
  button.addEventListener('click', async () => {
    const wunitAmount = document.getElementById('wunitAmount').value || '0';
    const usdcAmount = document.getElementById('usdcAmount').value || '0';
    const mode = button.getAttribute('data-liquidity');
    if (mode === 'remove') {
      await request('/admin/liquidity/remove', {
        method: 'POST',
        body: JSON.stringify({ shareBps: '1000' }),
      });
    } else {
      await request(`/admin/liquidity/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ wunitAmount, usdcAmount }),
      });
    }
    await refreshOverview();
  });
});

document.getElementById('replayForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await request('/admin/recovery/replay', {
    method: 'POST',
    body: JSON.stringify({ intentId: document.getElementById('replayIntentId').value }),
  });
  await refreshOverview();
});

document.getElementById('resolveForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const intentId = document.getElementById('resolveIntentId').value;
  const resolution = document.getElementById('resolveAction').value;
  await request(`/admin/intents/${intentId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution }),
  });
  await refreshOverview();
});

document.getElementById('releaseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const redemptionId = document.getElementById('releaseId').value;
  await request(`/admin/redemptions/${redemptionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await refreshOverview();
});

bridgeToggleButton.addEventListener('click', async () => {
  const paused = bridgeToggleButton.textContent.toLowerCase().includes('pause');
  await request('/admin/bridge/pause', {
    method: 'POST',
    body: JSON.stringify({ paused }),
  });
  await refreshOverview();
});

poolToggleButton.addEventListener('click', async () => {
  const paused = poolToggleButton.textContent.toLowerCase().includes('pause');
  await request('/admin/pool/pause', {
    method: 'POST',
    body: JSON.stringify({ paused }),
  });
  await refreshOverview();
});

(async function bootstrap() {
  try {
    await loadHealth();
    if (bridgeHealth?.adminAuthEnabled && bridgeHealth.adminUiTokenPrompt && !adminToken) {
      promptForAdminToken();
    }
    await refreshOverview();
  } catch (error) {
    serviceStatusEl.textContent = error.message;
    metricsEl.innerHTML = `<article class="metric"><h3>Error</h3><div class="note">${error.message}</div></article>`;
  }
}());
