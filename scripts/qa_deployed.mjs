/**
 * Browser QA for the DEPLOYED app, in a REAL headed Chrome.
 *
 * Why a bearer token rather than a browser login: the app sits behind the
 * Databricks OAuth wall, and an interactive sign-in cannot be scripted. A
 * workspace bearer token IS accepted by the app's auth proxy, but only CDP can
 * put a header on the top-level navigation — so this drives its own headed
 * Chrome over CDP and injects it.
 *
 * State plainly in any write-up: auth here is a bearer header, not an SSO
 * cookie. Everything else — DOM, JS, fetches, fonts, console — is a real
 * browser.
 *
 *   node scripts/qa_deployed.mjs <url> <token> [--port 9346] [--out /tmp/qa]
 *
 * Node 25 has a global WebSocket, so this has no dependencies.
 */
const args = process.argv.slice(2);
const URL_ = args[0];
const TOKEN = args[1];
const PORT = Number((args[args.indexOf('--port') + 1] || 0) || 9346);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/hello-isaac-qa';
if (!URL_ || !TOKEN) throw new Error('usage: qa_deployed.mjs <url> <token> [--port N] [--out prefix]');

const { writeFileSync } = await import('node:fs');

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
console.log(`[qa] attached to ${list.Browser}`);

const ws = new WebSocket(list.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (method, params) => send(method, params, sessionId);

await S('Page.enable');
await S('Runtime.enable');
await S('Log.enable');
await S('Network.enable');
await S('Network.setExtraHTTPHeaders', { headers: { Authorization: `Bearer ${TOKEN}` } });
await S('Emulation.setDeviceMetricsOverride', {
  width: 1728, height: 1000, deviceScaleFactor: 2, mobile: false,
});

const evaluate = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page threw: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails)}`);
  return r.result.value;
};

console.log(`[qa] navigating to ${URL_}`);
await S('Page.navigate', { url: URL_ });

/** Wait for the app to have actually RENDERED — not just for a 200. */
let state = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    state = await evaluate(`(() => ({
      ready: document.readyState,
      title: document.title,
      href: location.href,
      rootChildren: document.getElementById('root')?.children.length ?? 0,
      h1: document.querySelector('h1')?.innerText ?? null,
    }))()`);
  } catch { continue; }
  if (state.rootChildren > 0 && state.h1 && !/^hello …$/.test(state.h1)) break;
}
console.log(`[qa] ${JSON.stringify(state)}`);
// An expired token REDIRECTS to the sign-in page, whose own blocked assets throw
// hundreds of console errors — reporting those as "the app throws errors" would be
// a completely false conclusion. So assert what page we are on before anything else.
if (!/databricksapps\.com/.test(state.href) || /Sign In/i.test(state.title)) {
  throw new Error(`NOT on the app — landed on ${state.title} / ${state.href}`);
}

const shot = async (name) => {
  const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${OUT}-${name}.png`, Buffer.from(data, 'base64'));
  console.log(`[qa] screenshot → ${OUT}-${name}.png`);
};

const results = { page: state };
await shot('01-hero');

// ── the identity the page is actually showing ──────────────────────────────
results.identity = await evaluate(`(async () => {
  const me = await (await fetch('/api/me', { headers: { accept: 'application/json' } })).json();
  const text = document.body.innerText;
  return {
    h1: document.querySelector('h1')?.innerText,
    pills: [...document.querySelectorAll('main span')].map(s => s.innerText).filter(t => t && t.length < 60).slice(0, 12),
    apiDisplayName: me.displayName,
    apiEmail: me.userEmail,
    apiScim: me.identity.scim,
    apiSp: me.identity.servicePrincipal,
    greetingMatchesApi: !!me.displayName && text.includes(me.displayName.split(' ')[0]),
    spNameShownSomewhere: !!me.identity.servicePrincipal.name && text.includes(me.identity.servicePrincipal.name),
  };
})()`);

// ── fonts: a WIDTH comparison, because fonts.check() lies ──────────────────
results.fonts = await evaluate(`(() => {
  const m = (f, w) => { const c = document.createElement('canvas').getContext('2d'); c.font = w + ' 42px ' + f; return Math.round(c.measureText('Hamburgefonstiv 0123 · isaac').width * 100) / 100; };
  const bogus = m('"NoSuchFontZZZ"', 400);
  return {
    facesLoaded: [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status),
    dmSans: m('"DM Sans"', 400), dmSansBold: m('"DM Sans"', 700), dmMono: m('"DM Mono"', 400),
    bogus, systemUi: m('system-ui', 400),
    dmSansIsReal: m('"DM Sans"', 400) !== bogus,
    dmMonoIsReal: m('"DM Mono"', 400) !== bogus,
    boldIsRealNotSynthesised: m('"DM Sans"', 700) !== m('"DM Sans"', 400),
  };
})()`);

// ── diagram 1: the flow primitives ─────────────────────────────────────────
results.flowDiagram = await evaluate(`(() => {
  const sec = [...document.querySelectorAll('section')].find(s => (s.getAttribute('aria-label') || '').includes('wired'));
  if (!sec) return { error: 'flow section not found' };
  const texts = [...sec.querySelectorAll('div')].filter(d => d.children.length === 0 && d.innerText.trim()).map(d => ({ t: d.innerText.trim(), r: d.getBoundingClientRect() }));
  const hits = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 2 && oy > 2) hits.push(a.t + ' ⨯ ' + b.t);
  }
  return {
    stageNames: texts.map(t => t.t).filter(t => t.length < 24),
    labelCount: texts.length,
    animatedDots: sec.querySelectorAll('.db-flow-dot-animate, .db-fork-dot, .db-return-dot').length,
    svgCount: sec.querySelectorAll('svg').length,
    labelCollisions: hits,
  };
})()`);

// ── diagram 2: their real engine, in the iframe ────────────────────────────
results.engineDiagram = await evaluate(`(async () => {
  const tab = [...document.querySelectorAll('button[role="tab"]')].find(b => b.textContent.includes('Architecture engine'));
  if (!tab) return { error: 'engine tab not found' };
  tab.click();
  await new Promise(r => setTimeout(r, 5000));
  const f = document.querySelector('iframe');
  const doc = f?.contentDocument;
  if (!doc) return { error: 'iframe has no document' };
  const labels = [...doc.querySelectorAll('.react-flow__edge text')].map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
  const nodes = [...doc.querySelectorAll('.react-flow__node')].map(e => ({ t: e.textContent.trim().slice(0, 26), r: e.getBoundingClientRect() }));
  const all = [...labels.map(o => ({ ...o, k: 'label' })), ...nodes.map(o => ({ ...o, k: 'node' }))];
  const hits = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.t.startsWith("The operator's laptop") || b.t.startsWith("The operator's laptop")) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 2 && oy > 2) hits.push(a.k + ':' + a.t + ' ⨯ ' + b.k + ':' + b.t + ' ' + Math.round(ox) + 'x' + Math.round(oy));
  }
  return {
    archReady: doc.body.dataset.archReady ?? null,
    nodes: nodes.length, edgeLabels: labels.length,
    nodeNames: nodes.map(n => n.t),
    collisions: hits,
  };
})()`);
await shot('02-engine');

// back to the first tab and take a full-height capture of the flow diagram
await evaluate(`(() => { const t = [...document.querySelectorAll('button[role="tab"]')].find(b => b.textContent.includes('Flow primitives')); t?.click(); const s = [...document.querySelectorAll('section')].find(s => (s.getAttribute('aria-label')||'').includes('wired')); s?.scrollIntoView({ block: 'center' }); return true; })()`);
await new Promise((r) => setTimeout(r, 1200));
await shot('03-flow');

// dark theme
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'dark'); b?.click(); window.scrollTo(0, 0); return document.documentElement.className; })()`);
await new Promise((r) => setTimeout(r, 900));
await shot('04-dark');
results.darkClass = await evaluate(`document.documentElement.className`);
// put it back so the next viewer sees the default
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'light'); b?.click(); return document.documentElement.className; })()`);

// ── mobile pass: the same story stacked, no animated connectors ────────────
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await new Promise((r) => setTimeout(r, 900));
results.mobile = await evaluate(`(() => {
  const sec = [...document.querySelectorAll('section')].find(s => (s.getAttribute('aria-label') || '').includes('wired'));
  const list = sec?.querySelector('ol');
  const desktopRow = [...(sec?.children ?? [])].find(el => (el.className || '').includes('md:block'));
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  return {
    stackedListVisible: !!list && getComputedStyle(list).display !== 'none',
    stackedSteps: list ? list.children.length : 0,
    desktopRowHidden: !desktopRow || getComputedStyle(desktopRow).display === 'none',
    horizontalOverflow: overflow,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
})()`);
await shot('05-mobile');
await S('Emulation.setDeviceMetricsOverride', { width: 1728, height: 1000, deviceScaleFactor: 2, mobile: false });

// ── console: collect what the page actually logged ─────────────────────────
// First PROVE the collector is armed: an empty list is only meaningful if a real
// error would have shown up in it.
const PROBE = 'QA-PROBE console collector armed';
await evaluate(`(() => { console.error(${JSON.stringify(PROBE)}); return true; })()`);
await new Promise((r) => setTimeout(r, 400));
const consoleLines = events
  .filter((e) => e.method === 'Runtime.consoleAPICalled' || e.method === 'Log.entryAdded')
  .map((e) => {
    if (e.method === 'Log.entryAdded') return `[log.${e.params.entry.level}] ${e.params.entry.text}`;
    return `[console.${e.params.type}] ${e.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`;
  });
results.consoleInstrumentProven = consoleLines.some((l) => l.includes(PROBE));
results.console = consoleLines.filter((l) => !l.includes(PROBE));
results.failedRequests = events
  .filter((e) => e.method === 'Network.loadingFailed')
  .map((e) => `${e.params.type} ${e.params.errorText}`);

console.log('\n' + JSON.stringify(results, null, 2));
writeFileSync(`${OUT}-results.json`, JSON.stringify(results, null, 2));
await send('Target.closeTarget', { targetId });
ws.close();
