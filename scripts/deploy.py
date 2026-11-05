#!/usr/bin/env python3
"""
Deploy hello-isaac to a workspace, then PROVE it is really running.

Every `databricks` call passes --profile explicitly: an unprofiled call on this
machine enters an auth path that HANGS rather than failing (the default profile's
refresh token is expired), which looks exactly like a dead terminal.

The order matters and each step is asserted, because on this stack a deploy
reports success in at least four ways while shipping something broken:
  build → create (idempotent) → sync → prune stale remote → deploy → assert
The only assertion that counts is the last one: the app answering with the build
id and the feature set we just shipped.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = os.environ.get("APP_NAME", "hello-isaac")
PROFILE = os.environ.get("DATABRICKS_PROFILE", "DEFAULT")
WS_USER = os.environ["WS_USER"]  # your workspace user name (email), e.g. first.last@example.com
WS_PATH = os.environ.get("WS_PATH", f"/Workspace/Users/{WS_USER}/{APP}-src")
LOCAL = ROOT / "app"
TIMEOUT = 180


def run(args: list[str], *, timeout: int = TIMEOUT, check: bool = True, quiet: bool = False) -> str:
    """Run a command with a HARD timeout — a hanging databricks call is killed, not waited on."""
    if not quiet:
        print(f"  $ {' '.join(args)}", flush=True)
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise SystemExit(f"TIMEOUT after {timeout}s: {' '.join(args)}  (killed, not waited on)")
    if check and p.returncode != 0:
        raise SystemExit(f"FAILED ({p.returncode}): {' '.join(args)}\n{p.stdout}\n{p.stderr}")
    return p.stdout


def dbx(*args: str, **kw) -> str:
    return run(["databricks", *args, "--profile", PROFILE], **kw)


def dbx_json(*args: str, **kw):
    out = dbx(*args, "-o", "json", **kw)
    return json.loads(out) if out.strip() else None


def local_files() -> list[str]:
    return sorted(
        str(p.relative_to(LOCAL))
        for p in LOCAL.rglob("*")
        if p.is_file() and not any(part.startswith(".") for part in p.relative_to(LOCAL).parts)
    )


def remote_files(path: str) -> list[str]:
    """Recursive listing of the synced source dir (the CLI has no --recursive)."""
    out: list[str] = []
    stack = [path]
    while stack:
        cur = stack.pop()
        listing = dbx_json("workspace", "list", cur, quiet=True) or []
        for item in listing:
            p = item["path"]
            if item.get("object_type") == "DIRECTORY":
                stack.append(p)
            else:
                out.append(p[len(path) + 1 :] if p.startswith(path + "/") else p)
    return sorted(out)


def step(msg: str) -> None:
    print(f"\n=== {msg}", flush=True)


def main() -> int:
    build_id_path = LOCAL / "BUILD_ID"

    step("build (never ship a stale build)")
    run(["bash", str(ROOT / "scripts" / "build.sh")], timeout=900)
    build_id = build_id_path.read_text().strip()
    files = local_files()
    print(f"  BUILD_ID={build_id} · {len(files)} files to ship")
    js = [f for f in files if f.startswith("static/assets/") and f.endswith(".js")]
    if not js:
        raise SystemExit("no JS bundle locally — build.sh should have caught this")

    step(f"app {APP!r} exists?")
    app = dbx_json("apps", "get", APP, check=False) or None
    if not app or "name" not in (app or {}):
        print(f"  creating {APP} (this also starts its compute; ~1-2 min)")
        app = dbx_json("apps", "create", APP, "--description",
                       "Says hello to whoever opens it and draws the isaac supervisor rig",
                       timeout=1200)
    print(f"  compute={app.get('compute_status', {}).get('state')} url={app.get('url')}")

    step(f"sync {LOCAL} → {WS_PATH}")
    dbx("sync", "--full", str(LOCAL), WS_PATH, timeout=900)

    step("prune files the sync cannot delete (it only ever uploads)")
    remote = remote_files(WS_PATH)
    # Guard: both sides must show the sentinels, or a wrong root makes EVERY remote
    # file look stale — indistinguishable from "lots to clean up", and it would
    # delete the whole app.
    sentinels = ["server.mjs", "static/index.html"]
    missing_local = [s for s in sentinels if s not in files]
    missing_remote = [s for s in sentinels if s not in remote]
    if missing_local or missing_remote:
        raise SystemExit(f"prune refused: sentinels missing local={missing_local} remote={missing_remote}")
    stale = [f for f in remote if f not in files]
    print(f"  remote={len(remote)} local={len(files)} stale={len(stale)}")
    for f in stale:
        print(f"  deleting stale {f}")
        dbx("workspace", "delete", f"{WS_PATH}/{f}", quiet=True)

    step("assert the bundle actually landed in the workspace (not just 'sync said ok')")
    remote = remote_files(WS_PATH)
    for want in [*js, "static/index.html", "server.mjs", "app.yaml", "BUILD_ID",
                 "static/arch/architecture-viewer.html", "static/fonts/DMSans-100_1000-latin.woff2"]:
        if want not in remote:
            raise SystemExit(f"MISSING in {WS_PATH}: {want}\nremote listing: {remote}")
    print(f"  {len(remote)} files present, including {js[0]}")

    step("deploy")
    dbx("apps", "deploy", APP, "--source-code-path", WS_PATH, timeout=1800)

    step("assert the END STATE (compute ACTIVE *and* deployment SUCCEEDED — two state machines)")
    deadline = time.time() + 600
    while True:
        app = dbx_json("apps", "get", APP, quiet=True)
        compute = (app.get("compute_status") or {}).get("state")
        dep = ((app.get("active_deployment") or {}).get("status") or {}).get("state")
        print(f"  compute={compute} deployment={dep}")
        if compute == "ACTIVE" and dep == "SUCCEEDED":
            break
        if time.time() > deadline:
            raise SystemExit(f"gave up waiting: compute={compute} deployment={dep}")
        time.sleep(10)

    url = app["url"].rstrip("/")
    sp = app.get("service_principal_name") or app.get("service_principal_client_id")
    print(f"  url={url}  app SP={sp}")

    step("assert the SERVICE actually answers — with the build we just shipped")
    token = json.loads(dbx("auth", "token", quiet=True))["access_token"]

    def get(path: str, extra_headers: dict[str, str] | None = None, tries: int = 12):
        """Bearer-token GET. An unauthenticated GET returns 401 from the OAuth wall
        regardless of app health, so the token is what makes this a real probe."""
        last = None
        for i in range(tries):
            req = urllib.request.Request(url + path, headers={
                "Authorization": f"Bearer {token}", "accept": "application/json",
                **(extra_headers or {}),
            })
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.status, r.read().decode()
            except urllib.error.HTTPError as e:
                last = (e.code, e.read().decode()[:400])
                # 502 while a deployment is still settling is meaningless — retry.
                if e.code not in (502, 503):
                    return last
            except Exception as e:  # noqa: BLE001 — network flake during rollout
                last = (None, str(e))
            time.sleep(5)
        return last

    status, body = get("/api/health")
    print(f"  GET /api/health → {status}")
    if status != 200:
        raise SystemExit(f"health check failed: {status} {body}")
    health = json.loads(body)
    print("  " + json.dumps(health))
    problems = []
    if health.get("buildId") != build_id:
        problems.append(f"served buildId {health.get('buildId')} != local {build_id} (STALE snapshot)")
    if not health.get("deployed"):
        problems.append("app does not think it is deployed (DATABRICKS_APP_NAME missing)")
    if health.get("staticFiles") != len([f for f in files if f.startswith("static/")]):
        problems.append(
            f"served {health.get('staticFiles')} static files, shipped "
            f"{len([f for f in files if f.startswith('static/')])}"
        )
    if not (health.get("archViewer") or {}).get("hasSpec"):
        problems.append("architecture viewer shipped WITHOUT a diagram in it")
    if problems:
        raise SystemExit("END STATE WRONG:\n  - " + "\n  - ".join(problems))

    step("assert the identity path — who does the app think is calling?")
    status, body = get("/api/me")
    if status != 200:
        raise SystemExit(f"/api/me failed: {status} {body}")
    me = json.loads(body)
    ident = me["identity"]
    print(f"  greeting name : {me.get('displayName')!r}")
    print(f"  forwarded     : {json.dumps(ident['headers'])}")
    print(f"  obo token     : {json.dumps(ident['oboToken'])}")
    print(f"  scim /Me      : {json.dumps(ident['scim'])}")
    print(f"  app SP        : {json.dumps(ident['servicePrincipal'])}")
    if ident["source"] != "forwarded-headers":
        print("  WARNING: identity came from the DEV FALLBACK, not forwarded headers")

    step("assert a real page, not just an API")
    status, body = get("/", {"accept": "text/html"})
    ok_html = status == 200 and "<div id=\"root\">" in body and js[0].split("/")[-1] in body
    print(f"  GET / → {status} · references {js[0].split('/')[-1]}: {js[0].split('/')[-1] in (body or '')}")
    if not ok_html:
        raise SystemExit(f"index.html did not come back with the expected bundle reference: {body[:400]}")

    print(f"\nDEPLOYED · {url}")
    print(f"  build {build_id} · {len(files)} files · app SP {sp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
