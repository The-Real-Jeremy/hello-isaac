/**
 * hello-isaac — server.
 *
 * ZERO npm dependencies, on purpose. solution-builder's generated apps run
 * Express via @databricks/appkit, but a deploy that has to fetch packages depends
 * on which registry the build container can reach, so any dependency at all turns deployment into a registry problem. With an
 * empty dependency list the container's `npm install` has nothing to fetch and
 * cannot fail. The identity logic below is a faithful port of their
 * `server/lib/user.ts` + `server/lib/auth.ts`; only the plumbing is different.
 *
 * Routes
 *   GET /api/me              identity of the CALLER + the evidence for it
 *   GET /api/health          build id, what actually shipped, deploy detection
 *   GET /api/debug/headers   header names + redacted values (token never shown)
 *   GET /*                   static files from ./static, SPA fallback to index.html
 */
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(HERE, 'static');
const ARCH_VIEWER = join(STATIC_DIR, 'arch', 'architecture-viewer.html');
const PORT = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8765);
const STARTED_AT = new Date().toISOString();

/** Deployed vs local: the platform always sets DATABRICKS_APP_NAME in the container. */
const APP_NAME = process.env.DATABRICKS_APP_NAME ?? null;
const IS_DEPLOYED = !!APP_NAME;

/** Build id: written by scripts/build.sh, overridable by env. Never a bare
 *  timestamp — a UTC stamp read in local time looks stale and sends you hunting
 *  a deploy that worked, so this carries the git sha too. */
const BUILD_ID =
  process.env.BUILD_ID ??
  (existsSync(join(HERE, 'BUILD_ID')) ? readFileSync(join(HERE, 'BUILD_ID'), 'utf8').trim() : 'dev');

/**
 * MEASURED, not assumed: inside a Databricks Apps container DATABRICKS_HOST is
 * injected WITHOUT a scheme (`<workspace>.cloud.databricks.com`), while the
 * same variable in a ~/.databrickscfg profile carries `https://`. Passing the
 * bare host to fetch() throws "Failed to parse URL", which surfaced as
 * "SCIM check unavailable" on the first deploy. Normalise both shapes.
 */
function normaliseHost(raw) {
  const t = (raw ?? '').trim().replace(/\/$/, '');
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const WORKSPACE_HOST = normaliseHost(process.env.DATABRICKS_HOST ?? process.env.WORKSPACE_HOST);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/* ───────────────────────── identity ─────────────────────────────────────── */

const PLACEHOLDER_EMAIL = 'local_user@example.com';

/** Port of solution-builder's getCurrentUserEmail(req). */
function currentUserEmail(h) {
  const forwardedEmail = h['x-forwarded-email'] ?? '';
  if (forwardedEmail) return forwardedEmail;
  const forwardedUser = h['x-forwarded-user'] ?? '';
  if (forwardedUser.includes('@')) return forwardedUser;
  return process.env.DEV_USER_EMAIL ?? PLACEHOLDER_EMAIL;
}

/** Port of solution-builder's getCurrentUserInfo(req). */
function currentUserInfo(h) {
  const userName =
    h['x-forwarded-preferred-username'] ?? h['x-forwarded-user'] ?? process.env.USER ?? 'dev-user';
  const userEmail = h['x-forwarded-email'] ?? null;
  return {
    userName,
    userEmail,
    // Upstream passes DATABRICKS_HOST through raw; normalised here because the
    // container's value has no scheme and renders as a bare hostname.
    workspaceUrl: WORKSPACE_HOST,
    workspaceId: process.env.DATABRICKS_WORKSPACE_ID ?? null,
  };
}

/**
 * Ask the WORKSPACE who a token belongs to. This is the whole identity proof:
 * the greeting is not just a header we were handed, it is an identity the
 * workspace confirms for the token that arrived with this request.
 *
 * `iam.current-user:read` is one of the two scopes every Apps OBO token carries
 * by default, so this needs no extra scope in app.yaml.
 */
async function scimMe(bearer, { timeoutMs = 6000 } = {}) {
  if (!WORKSPACE_HOST) return { ok: false, status: null, error: 'no DATABRICKS_HOST in env' };
  if (!bearer) return { ok: false, status: null, error: 'no token to check' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${WORKSPACE_HOST}/api/2.0/preview/scim/v2/Me`, {
      headers: { Authorization: `Bearer ${bearer}`, accept: 'application/json' },
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status} ${text.slice(0, 180)}` };
    }
    // An expired token answers 401 with body `{}`, which parses fine — so treat a
    // missing userName as a failure rather than a successful empty answer.
    const body = text.trim() ? JSON.parse(text) : {};
    const userName = body.userName ?? null;
    if (!userName) return { ok: false, status: res.status, error: '200 with no userName in the body' };
    return {
      ok: true,
      status: res.status,
      id: body.id ?? null,
      userName,
      displayName: body.displayName ?? null,
    };
  } catch (e) {
    return { ok: false, status: null, error: e?.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The control: who does the APP itself run as? Mint a service-principal token
 * from the injected client credentials and ask SCIM /Me with THAT. If the page
 * were greeting the app rather than the viewer, this is the name it would show.
 * Cached for the process lifetime — it never changes.
 */
let spCache = null;
async function appServicePrincipal() {
  if (spCache) return spCache;
  const clientId = process.env.DATABRICKS_CLIENT_ID ?? null;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET ?? null;
  const out = { clientId, name: null };
  if (!clientId || !clientSecret || !WORKSPACE_HOST) {
    spCache = out;
    return out;
  }
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${WORKSPACE_HOST}/oidc/v1/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&scope=all-apis',
    });
    if (res.ok) {
      const tok = (await res.json())?.access_token;
      const who = await scimMe(tok);
      if (who.ok) out.name = who.displayName ?? who.userName;
    }
  } catch {
    /* the control is a nice-to-have; the client id alone still makes the point */
  }
  spCache = out;
  return out;
}

/* ───────────────────────── routes ───────────────────────────────────────── */

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handleMe(req, res) {
  const h = req.headers;
  const info = currentUserInfo(h);
  const token = h['x-forwarded-access-token'];
  const [scim, sp] = await Promise.all([scimMe(token), appServicePrincipal()]);
  const forwardedAny =
    !!h['x-forwarded-email'] || !!h['x-forwarded-preferred-username'] || !!h['x-forwarded-user'];
  sendJson(res, 200, {
    ...info,
    // Prefer the workspace's own answer for the display name; fall back to the
    // forwarded username. Never a hardcoded name, in either branch.
    displayName: (scim.ok && scim.displayName) || (info.userName?.includes('@') ? null : info.userName) || null,
    email: currentUserEmail(h),
    identity: {
      source: forwardedAny ? 'forwarded-headers' : 'dev-fallback',
      headers: {
        'x-forwarded-email': h['x-forwarded-email'] ?? null,
        'x-forwarded-preferred-username': h['x-forwarded-preferred-username'] ?? null,
        'x-forwarded-user': h['x-forwarded-user'] ?? null,
      },
      oboToken: { present: !!token, length: token ? token.length : null },
      scim,
      servicePrincipal: sp,
    },
    app: { name: APP_NAME, buildId: BUILD_ID, startedAt: STARTED_AT },
  });
}

/** Count what actually shipped, so a green check can't pass over nothing. */
async function countStatic(dir) {
  let n = 0;
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      n += entry.isDirectory() ? await countStatic(join(dir, entry.name)) : 1;
    }
  } catch {
    /* missing dir → 0, and /api/health will say so */
  }
  return n;
}

async function handleHealth(_req, res) {
  let arch = { present: false, bytes: null, hasSpec: false };
  try {
    const st = await stat(ARCH_VIEWER);
    // Read only the head: the file is ~1.9 MB and the inline JSON block is at the top.
    const head = (await readFile(ARCH_VIEWER)).subarray(0, 20000).toString('utf8');
    const block = head.match(/<script type="application\/json" id="architecture">([\s\S]*?)<\/script>/);
    const raw = (block?.[1] ?? '').trim();
    arch = {
      present: true,
      bytes: st.size,
      // "has a spec" means a real diagram, not the placeholder `{}` the renderer ships with.
      hasSpec: raw.length > 200 && raw !== '{}' && /"nodes"/.test(raw),
    };
  } catch {
    /* reported as present:false */
  }
  sendJson(res, 200, {
    ok: true,
    buildId: BUILD_ID,
    now: new Date().toISOString(),
    deployed: IS_DEPLOYED,
    staticFiles: await countStatic(STATIC_DIR),
    archViewer: arch,
  });
}

function handleDebugHeaders(req, res) {
  const redacted = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const secret = /token|authorization|cookie|secret/i.test(k);
    redacted[k] = secret ? `<redacted · ${String(v).length} chars>` : v;
  }
  sendJson(res, 200, { names: Object.keys(req.headers).sort(), headers: redacted });
}

/* ───────────────────────── static ───────────────────────────────────────── */

function cacheControlFor(pathname) {
  // Hashed asset names change every build → safe to cache hard.
  if (/^\/assets\//.test(pathname)) return 'public, max-age=31536000, immutable';
  if (/^\/fonts\//.test(pathname)) return 'public, max-age=604800';
  // Everything else keeps its filename across deploys (index.html, the arch
  // viewer), and a stale cached copy has faked a green check on this stack
  // before — so never store those.
  return 'no-store';
}

async function serveStatic(req, res, pathname) {
  // Contain the path inside STATIC_DIR: normalize, then reject anything that
  // escapes. (No dependency doing this for us.)
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(STATIC_DIR, rel);
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // SPA fallback — but only for page-ish requests, never for a missing asset
    // (a 200 index.html in place of a missing .js is how "it works" lies).
    if (extname(filePath)) {
      res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('not found');
      return;
    }
    filePath = join(STATIC_DIR, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': cacheControlFor(pathname),
      'content-length': body.length,
      'x-build-id': BUILD_ID,
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(`cannot read ${rel}: ${e}`);
  }
}

/* ───────────────────────── boot ─────────────────────────────────────────── */

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const p = url.pathname;
  const route =
    p === '/api/me' ? handleMe
    : p === '/api/health' ? handleHealth
    : p === '/api/debug/headers' ? handleDebugHeaders
    : null;
  if (route) {
    Promise.resolve(route(req, res)).catch((e) => {
      // Never a silent 200: an error here must be visible in the UI.
      if (!res.headersSent) sendJson(res, 500, { error: String(e) });
    });
    return;
  }
  serveStatic(req, res, p).catch((e) => {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[hello-isaac] listening on 0.0.0.0:${PORT} · build ${BUILD_ID} · ` +
      `${IS_DEPLOYED ? `deployed as ${APP_NAME}` : 'local'} · workspace ${WORKSPACE_HOST || '(none in env)'}`,
  );
});
