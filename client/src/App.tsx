/**
 * hello-isaac — a deliberately small Databricks App with two jobs:
 *   1. say hello to WHOEVER opened it (real per-viewer identity, not the app's
 *      service principal and not a hardcoded name), and show the evidence;
 *   2. draw one honest architecture diagram of an agent supervisor rig,
 *      using solution-builder's own drawing code.
 *
 * Shell styling follows solution-builder's desktop UI: DM Sans, the oklch
 * hue-248 token set, radius 0.625rem, cards on a near-white canvas.
 */
import { useEffect, useState } from 'react';
import { fetchHealth, fetchMe, type Health, type Me } from '@/lib/api';
import { SupervisorFlow } from '@/architecture/SupervisorFlow';
import { AppsIcon } from '@/architecture/icons';

type Tab = 'rig' | 'engine';

/* ─── theme (light default, matches the desktop tool) ───────────────────── */

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('hello-isaac-theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('hello-isaac-theme', dark ? 'dark' : 'light');
    } catch {
      /* private window — the toggle still works for this session */
    }
  }, [dark]);
  return { dark, setDark };
}

/* ─── small pieces ─────────────────────────────────────────────────────── */

/**
 * The greeting name, from whatever the platform gave us — in descending order of
 * niceness. Deployed, `x-forwarded-preferred-username` is already a display name
 * ("Ada Lovelace") and SCIM confirms it; locally it can be a shell username
 * ("ada.lovelace") or an email. All three shapes have to come out as "Ada",
 * and none of them is ever hardcoded.
 */
function firstName(me: Me | null): string | null {
  const source = (me?.displayName || me?.userName || me?.userEmail || '').trim();
  if (!source) return null;
  const head = source.split('@')[0].split(/\s+/)[0];
  const first = head.split(/[._-]/)[0];
  if (!first) return null;
  // Only case-fix an all-lowercase handle; leave a real name's own casing alone.
  return first === first.toLowerCase() ? first[0].toUpperCase() + first.slice(1) : first;
}

function initials(me: Me | null): string {
  const src = me?.displayName || me?.userName || me?.userEmail || '?';
  const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <div className="flex flex-col gap-1 border-t py-2.5 sm:flex-row sm:items-baseline sm:gap-4" style={{ borderColor: 'var(--border)' }}>
      <div className="w-full shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted-foreground)] sm:w-72">
        {k}
      </div>
      <div
        className="min-w-0 break-words font-mono text-[12.5px]"
        style={{ color: tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--destructive)' : 'var(--foreground)' }}
      >
        {v}
      </div>
    </div>
  );
}

function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'ok' | 'warn' }) {
  const bg =
    tone === 'ok'
      ? 'color-mix(in oklch, var(--success) 14%, transparent)'
      : tone === 'warn'
        ? 'color-mix(in oklch, var(--destructive) 14%, transparent)'
        : 'var(--secondary)';
  const fg = tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--destructive)' : 'var(--secondary-foreground)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/* ─── page ─────────────────────────────────────────────────────────────── */

export function App() {
  const { dark, setDark } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rig');

  useEffect(() => {
    fetchMe().then(setMe).catch((e: unknown) => setError(String(e)));
    fetchHealth().then(setHealth).catch(() => {
      /* health is diagnostics only — never block the greeting on it */
    });
  }, []);

  const name = firstName(me);
  const scim = me?.identity.scim;
  const scimAgrees =
    scim?.ok === true &&
    !!me?.userEmail &&
    (scim.userName?.toLowerCase() === me.userEmail.toLowerCase() ||
      scim.displayName === me.displayName);

  return (
    <div className="min-h-screen">
      {/* header */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklch, var(--background) 82%, transparent)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 sm:px-8">
          <span style={{ width: 26, height: 26 }} aria-hidden>
            <AppsIcon />
          </span>
          <span className="font-mono text-[13px] font-medium tracking-tight">hello-isaac</span>
          <span className="hidden text-[12px] text-[var(--muted-foreground)] sm:inline">
            · a Databricks App
          </span>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setDark(!dark)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              style={{ borderColor: 'var(--border)' }}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {dark ? 'light' : 'dark'}
            </button>
            {me && (
              <span className="flex items-center gap-2.5">
                <span
                  className="grid place-items-center rounded-full text-[11px] font-semibold"
                  style={{ width: 28, height: 28, background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  aria-hidden
                >
                  {initials(me)}
                </span>
                <span className="hidden font-mono text-[12px] text-[var(--muted-foreground)] sm:inline">
                  {me.userEmail ?? me.userName}
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        {/* hero */}
        <section aria-live="polite">
          {error ? (
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: 'color-mix(in oklch, var(--destructive) 45%, var(--border))' }}
            >
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--destructive)' }}>
                Could not read your identity
              </h1>
              <p className="mt-2 font-mono text-[12.5px] text-[var(--muted-foreground)]">{error}</p>
            </div>
          ) : (
            <>
              <h1
                className={
                  'text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[56px] ' +
                  (name ? 'animate-hello-rise' : '')
                }
              >
                {name ? (
                  <>
                    hello{' '}
                    <span style={{ color: 'var(--primary)' }}>{name}</span>
                  </>
                ) : (
                  <span className="text-[var(--muted-foreground)]">hello …</span>
                )}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                {me ? (
                  <>
                    You are signed in as{' '}
                    <span className="font-mono text-[13.5px] text-[var(--foreground)]">
                      {me.userEmail ?? me.userName}
                    </span>
                    . That name is not baked into this page — it is read from the identity Databricks Apps
                    forwards for whoever opened it, and confirmed below by asking the workspace who your own
                    token belongs to.
                  </>
                ) : (
                  'Reading the identity Databricks Apps forwarded for this request…'
                )}
              </p>
              {me && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Pill tone={me.identity.source === 'forwarded-headers' ? 'ok' : 'warn'}>
                    <span
                      className="animate-live-dot inline-block rounded-full"
                      style={{ width: 6, height: 6, background: 'currentColor' }}
                      aria-hidden
                    />
                    {me.identity.source === 'forwarded-headers' ? 'live per-viewer identity' : 'dev fallback identity'}
                  </Pill>
                  <Pill tone={scim?.ok ? (scimAgrees ? 'ok' : 'warn') : 'warn'}>
                    {scim?.ok
                      ? scimAgrees
                        ? 'workspace agrees (SCIM /Me)'
                        : 'SCIM answered a DIFFERENT identity'
                      : 'SCIM check unavailable'}
                  </Pill>
                  {me.app.name && <Pill>app · {me.app.name}</Pill>}
                  <Pill>build · {me.app.buildId}</Pill>
                </div>
              )}
            </>
          )}
        </section>

        {/* diagram */}
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">The isaac supervisor rig</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Drawn twice with solution-builder's own code: its animated flow primitives, and the
                React Flow engine behind its architecture skill.
              </p>
            </div>
            <div
              className="inline-flex rounded-lg border p-1"
              style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
              role="tablist"
              aria-label="Diagram renderer"
            >
              {(
                [
                  ['rig', 'Flow primitives'],
                  ['engine', 'Architecture engine'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className="rounded-md px-3 py-1.5 font-mono text-[11.5px] transition-colors"
                  style={
                    tab === id
                      ? { background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }
                      : { color: 'var(--muted-foreground)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'rig' ? (
            <SupervisorFlow />
          ) : (
            <div className="rounded-xl border bg-[var(--card)] p-2" style={{ borderColor: 'var(--border)' }}>
              <p className="px-3 pb-2 pt-2 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
                The same rig through solution-builder's real diagram engine — the @xyflow/react canvas from its
                desktop app, shipped as a self-contained renderer by its{' '}
                <span className="font-mono text-[12px]">databricks-architecture</span> skill, fed this app's{' '}
                <span className="font-mono text-[12px]">arch/isaac-supervisor.arch.json</span>. Drag to pan, scroll
                to zoom.
              </p>
              <iframe
                src="/arch/architecture-viewer.html"
                title="isaac supervisor rig — solution-builder architecture engine"
                className="w-full rounded-lg border-0 bg-white"
                style={{ height: 620, display: 'block' }}
              />
            </div>
          )}
        </section>

        {/* identity evidence */}
        {me && (
          <section className="mt-10 rounded-xl border bg-[var(--card)] p-5 sm:p-7" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              How this page knows who you are
            </div>
            <p className="mb-4 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
              Databricks Apps terminates OAuth in front of the container and forwards the caller's identity on
              every request. This app reads exactly the headers solution-builder's own template reads
              (<span className="font-mono text-[12.5px]">server/lib/user.ts</span>), then does one extra thing to
              prove the value is really yours: it calls SCIM{' '}
              <span className="font-mono text-[12.5px]">/Me</span> with <em>your</em> forwarded token and shows
              what the workspace says back.
            </p>
            <div>
              <Row k="x-forwarded-preferred-username" v={me.identity.headers['x-forwarded-preferred-username'] ?? '(not sent)'} />
              <Row k="x-forwarded-email" v={me.identity.headers['x-forwarded-email'] ?? '(not sent)'} />
              <Row k="x-forwarded-user" v={me.identity.headers['x-forwarded-user'] ?? '(not sent)'} />
              <Row
                k="x-forwarded-access-token"
                v={
                  me.identity.oboToken.present
                    ? `present · ${me.identity.oboToken.length} chars · never shown or logged`
                    : '(not sent — no on-behalf-of token on this request)'
                }
                tone={me.identity.oboToken.present ? 'ok' : undefined}
              />
              <Row
                k="SCIM /Me · called with YOUR token"
                v={
                  scim?.ok
                    ? `${scim.displayName ?? '—'} · ${scim.userName ?? '—'} · id ${scim.id ?? '—'}`
                    : `unavailable — ${scim?.error ?? 'no result'}`
                }
                tone={scim?.ok ? 'ok' : 'warn'}
              />
              <Row
                k="app service principal (who the app runs as)"
                v={
                  me.identity.servicePrincipal.clientId
                    ? `${me.identity.servicePrincipal.name ?? 'app SP'} · ${me.identity.servicePrincipal.clientId}`
                    : '(not resolvable from this container)'
                }
              />
              <Row k="workspace" v={`${me.workspaceUrl || '—'}${me.workspaceId ? ` · id ${me.workspaceId}` : ''}`} />
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--muted-foreground)]">
              The service-principal row is the control: if this page were greeting the app instead of you, that
              is the identity you would see at the top.
            </p>
          </section>
        )}

        <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 font-mono text-[11.5px] text-[var(--muted-foreground)]" style={{ borderColor: 'var(--border)' }}>
          <span>build {me?.app.buildId ?? health?.buildId ?? '…'}</span>
          <span>{health ? `${health.staticFiles} static files served from the deploy snapshot` : ''}</span>
          <span>{health?.deployed ? 'running on Databricks Apps' : 'running locally'}</span>
        </footer>
      </main>
    </div>
  );
}
