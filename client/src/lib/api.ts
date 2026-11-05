/**
 * Typed client for this app's two endpoints. Mirrors solution-builder's
 * `client/src/lib/api.ts` idiom: one fetch helper, one type per endpoint, no
 * data-fetching library.
 */

export type ScimProof =
  | { ok: true; status: number; id: string | null; userName: string | null; displayName: string | null }
  | { ok: false; status: number | null; error: string };

export type Me = {
  /** x-forwarded-preferred-username — what solution-builder greets you by. */
  userName: string;
  /** x-forwarded-email — the stable per-user key. */
  userEmail: string | null;
  workspaceUrl: string;
  workspaceId: string | null;
  /** Best display name available: SCIM first, then the forwarded username. */
  displayName: string | null;
  identity: {
    source: 'forwarded-headers' | 'dev-fallback';
    headers: Record<string, string | null>;
    oboToken: { present: boolean; length: number | null };
    scim: ScimProof;
    servicePrincipal: { clientId: string | null; name: string | null };
  };
  app: { name: string | null; buildId: string; startedAt: string };
};

export type Health = {
  ok: true;
  buildId: string;
  now: string;
  deployed: boolean;
  staticFiles: number;
  archViewer: { present: boolean; bytes: number | null; hasSpec: boolean };
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (!text.trim()) throw new Error(`${path} → 200 with an EMPTY body`);
  return JSON.parse(text) as T;
}

export const fetchMe = () => getJson<Me>('/api/me');
export const fetchHealth = () => getJson<Health>('/api/health');
