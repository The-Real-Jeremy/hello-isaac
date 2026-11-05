# hello-isaac

## Install (browser only: no terminal, no CLI, works air-gapped)

Everything the app needs is in this repo: zero dependencies and a prebuilt frontend. Two ways to install it; both use the `DEPLOY` notebook.

### A) Install on its own (a standalone Databricks App)
1. On this GitHub page: **Code → Download ZIP** (`hello-isaac-main.zip`). No need to unzip it.
2. In Databricks: **Workspace** → a folder (e.g. your home) → **⋮ → Import** → drop the `.zip` → **Import**.
   Databricks unzips it into `hello-isaac-main/`.
3. Open **`hello-isaac-main/DEPLOY`**, attach **Serverless**, set **mode = `standalone`** (and `standalone_app_name`
   if you want a different name), then **Run all**.
4. The last cell prints the **app URL**.

### B) Install as a child of [App-ception](https://github.com/The-Real-Jeremy/app-ception)
App-ception was called App Catalog. An older `app-catalog-main/` folder and an `app-catalog` app are found too.
1. Install the App-ception first (its README, same four steps), so `app-ception-main/` is in your workspace.
2. On this GitHub page: **Code → Download ZIP** (`hello-isaac-main.zip`).
3. In Databricks: open **the same folder that holds `app-ception-main/`** → **⋮ → Import** → drop the `.zip`.
   It unzips into `hello-isaac-main/` next to the catalog.
4. Open **`hello-isaac-main/DEPLOY`**, attach **Serverless**, leave **mode = `child`** (`catalog_folder` is filled in
   for you), then **Run all**. It copies the app into the catalog's `child_apps/hello_isaac/`, adds the scopes the app
   needs to the catalog app, and redeploys the catalog. The last cell prints `<catalog URL>/apps/hello_isaac/`.
   If you gave the App-ception app a name other than `app-ception`, set **`catalog_app_name`** to that name first.

**Budget policies:** child mode never creates an app; it redeploys the existing catalog, so a workspace policy
requirement cannot stop it. For standalone mode in a workspace that requires a budget policy, set the
`budget_policy_id` widget, or create the app in the UI first (pick the policy, add the scopes this app needs), then
Run all. If exactly one policy is in use, it is picked automatically and the app bills against it; set `budget_policy_id` to choose explicitly.

**To update** either way: first **rename or delete the existing `hello-isaac-main/` folder**. Importing a ZIP onto a
folder that already exists is refused ("already exists"), and nothing is overwritten. Then import the new ZIP and run
`DEPLOY` again. In child mode, the previous copy inside the catalog is kept as `.bak-child-…`.

---

A deliberately small Databricks App that does two things:

1. says **hello to whoever opened it**: the real signed-in viewer, not the app's service principal
   and not a hardcoded name. It shows the evidence for that claim.
2. draws **one honest diagram of an agent supervisor rig** (a human talking to one supervisor agent
   through a chat channel, which delegates to project agents), using
   [databricks-solutions/solution-builder](https://github.com/databricks-solutions/solution-builder)'s
   own architecture-drawing code. It draws it twice, because that repo has two different mechanisms for it.

Zero runtime dependencies (one dependency-free `server.mjs`, and a prebuilt client), so it deploys
anywhere, including a workspace with no internet access.

---

## How user identity is obtained (and how it was proved)

`app/server.mjs` is a faithful port of solution-builder's own
`app_template/server/lib/user.ts` + `auth.ts`. Databricks Apps terminates OAuth **in front of** the
container and forwards the caller on every request. Values below are **anonymised examples**; the
shapes are as measured in a deployed container:

| header | what arrives |
|---|---|
| `x-forwarded-email` | `ada.lovelace@example.com` |
| `x-forwarded-preferred-username` | `Ada Lovelace`: a **display name**, not a username |
| `x-forwarded-user` | `<user id>@<workspace id>` |
| `x-forwarded-access-token` | the viewer's **on-behalf-of** token, present with **no** `user_authorization` block in `app.yaml` |

The greeting is `x-forwarded-preferred-username` (falling back to the email's local part), exactly
as their template does. Then this app adds one thing their template does not:

> **It calls SCIM `/api/2.0/preview/scim/v2/Me` with *the viewer's own forwarded token*** and shows
> what the workspace answers. `iam.current-user:read` is one of the two scopes every Apps OBO token
> carries by default, so this needs no extra scope.

That turns "a header said so" into "the workspace confirms this token belongs to that person".

### What was verified (names and ids anonymised)

| # | Test | Result |
|---|---|---|
| 1 | Deployed, authenticated as a real user | the page greets the viewer; `/api/me` shows their email; SCIM `/Me` returns the same person's name and id: **the header and the token agree** |
| 2 | **Control: is it the app's own identity?** | the app's service principal (`app-xxxxxx hello-isaac`) is resolved live by minting an SP token from the injected client credentials and asking SCIM `/Me` as the SP. It is shown on the page next to the viewer's identity, so the greeting is provably not the SP. |
| 3 | **Spoof: can the client dictate the identity?** | `curl` with a valid bearer token **plus** forged `X-Forwarded-Email: mallory@example.com` / `X-Forwarded-Preferred-Username` / `X-Forwarded-User`. The app still saw the real viewer. **The platform overwrites client-supplied `X-Forwarded-*` headers.** |
| 4 | Mismatch detector is real (not vacuous) | locally, a real token with a header claiming `someone.else@example.com` is **detected**: the page's "workspace agrees" pill flips to "SCIM answered a DIFFERENT identity". A garbage token yields SCIM `401`, not a silent pass. |
| 5 | Dev fallback is labelled, not faked | with no forwarded headers (running locally) the page says **"dev fallback identity"** in red and every header row reads `(not sent)`. |

Ask a colleague to open the URL (any workspace user can; they need no grant): they are greeted by
their own name.

---

## The diagram

Two tabs, both rendered from solution-builder's own code:

**"Flow primitives"**: `client/src/architecture/Flow.tsx` + `icons.tsx`, vendored and modified from
`app_template/client/src/architecture/`: white tiles, two-tone coral glyphs, a thin connector with a
coral dot riding it, `<Fork>` for a 1→2 split. There is **no diagram library**: it is React +
inline SVG + CSS keyframes. Added in the same idiom: `<Join>` (2→1), `<Return>` (a labelled U-turn
whose dot travels backwards) and an optional connector label.

**"Architecture engine"**: solution-builder's *real* diagram engine, the `@xyflow/react` canvas
shipped by its `databricks-architecture` skill as one self-contained HTML file.
`vendor/solution-builder/architecture-viewer.html` is the pristine copy. `scripts/build-arch.mjs`
swaps in `arch/isaac-supervisor.arch.json` (their schema: lanes, `rowGrid`, `wraps` boxes, `note`
post-its, `custom_logos`) and adds a self-hosted DM Sans `@font-face`, because the bundle asks for
DM Sans and embeds no font.

To draw your own system instead, edit `arch/isaac-supervisor.arch.json` and
`client/src/architecture/SupervisorFlow.tsx`, then run `./scripts/build.sh`.

---

## Layout

```
app/                     what ships (source_code_path: its CONTENTS are flattened into the container)
  app.yaml               command + NODE_ENV. No scopes needed for the identity proof.
  package.json           ZERO dependencies, on purpose (see below)
  server.mjs             the whole server: static files + /api/me + /api/health + /api/debug/headers
  static/                the built client, COMMITTED (see below)
client/                  React 19 + Vite + Tailwind 4 source; self-hosted DM Sans/DM Mono in public/fonts
arch/                    isaac-supervisor.arch.json: the diagram, in solution-builder's schema
vendor/solution-builder/ pristine copies + LICENSE + NOTICE + provenance (Databricks licence)
scripts/                 build.sh · build-arch.mjs · deploy.py · qa_deployed.mjs
catalog.yaml             card metadata when it runs inside the App-ception
```

**Two deliberate choices that look odd:**
- **Zero runtime npm dependencies.** solution-builder's generated apps run Express via
  `@databricks/appkit`, but a deploy that has to fetch packages depends on which registry the build
  container can reach, so *any* dependency turns a deploy into a registry problem. With an empty
  dependency list the container's `npm install` has nothing to fetch.
- **`app/static/` is committed.** `databricks sync` honours `.gitignore` and ships the working tree,
  so an ignored build directory is silently dropped, and that failure prints `Deployment complete!`.

---

## Deploy

### Standalone (CLI)
```bash
DATABRICKS_PROFILE=<profile> WS_USER=<you@example.com> python3 scripts/deploy.py
```
The steps are build, create-if-missing, sync, prune, deploy, then assert. `deploy.py` passes
`--profile` on every `databricks` call and puts a hard timeout on each one. It asserts that:
- the bundle is in the workspace folder;
- the compute is `ACTIVE` **and** the deployment `SUCCEEDED`;
- `/api/health` reports the build just made and a diagram inside the viewer;
- `/api/me` resolves an identity.

It also prunes the workspace folder, because `sync --full` only uploads. Overrides: `APP_NAME`,
`DATABRICKS_PROFILE`, `WS_USER`, `WS_PATH`.

### As a child of the [App-ception](https://github.com/The-Real-Jeremy/app-ception) (CLI alternative)
```bash
rsync -a --exclude .git --exclude node_modules hello-isaac/ <app-ception>/child_apps/hello_isaac/
cd <app-ception> && npm run deploy
```
The catalog finds `app/app.yaml`, runs `node server.mjs` on its own port under `/apps/hello_isaac/`,
and takes the card text from `catalog.yaml`. Identity works unchanged: the catalog forwards the
viewer's headers and token.

### Air-gapped / UI only
See **Install** at the top: the `DEPLOY` notebook does both paths from the browser.

Build only (no deploy): `./scripts/build.sh`. Local run: `node app/server.mjs`, then
http://127.0.0.1:8765. The identity shows the labelled dev fallback; set `DATABRICKS_HOST` to make
the SCIM row live for a request that carries a token.

## Browser QA

```bash
TOK=$(databricks auth token -p "$DATABRICKS_PROFILE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir=/tmp/hello-isaac-qa-profile --remote-debugging-port=9346 \
  --no-first-run --window-size=1728,1000 about:blank &
node scripts/qa_deployed.mjs "https://<your app url>/" "$TOK" --port 9346
```

Use a headed Chrome. The app sits behind the OAuth wall, so the driver injects a workspace bearer
token over CDP. **Auth is a bearer header, not an SSO cookie**; everything else (DOM, JS, fetches,
fonts, console) is a real browser. It asserts what it looked at:
- the page title and URL *before* believing any console count;
- fonts by **width comparison** (`document.fonts.check()` returns true with zero faces loaded);
- label collisions, by measuring every rendered box;
- and it emits a deliberate `console.error`, to prove the console collector was armed.
