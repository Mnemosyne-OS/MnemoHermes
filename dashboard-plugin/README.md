# Mnemosyne OS — Hermes dashboard plugin

> ✅ **First-run verified 2026-08-12** against a live dashboard (Hermes
> v0.20.0): tab renders, live tiles answer, backend route auth-gated.
> Results and the two doc-vs-reality gaps are recorded below.

A tab named **Mnemosyne OS** in the Hermes Agent dashboard (port 9119):
liveness of the desktop app and the brain proxy, the memory covenant
(skill install command), and the veto-inbox pitch with a pointer to the
MnemoHermes cockpit. The strategic role is doc 80 §dashboard-plugin
channel: our presence in the screen every Hermes user already opens.

## Layout

```
dashboard-plugin/
  README.md            ← you are here (does not ship meaning; rides along fine)
  plugin.yaml          ← ROOT manifest — required by `hermes plugins enable`
  __init__.py          ← no-op register(ctx) — required by the agent loader
  dashboard/
    manifest.json      ← tab "/mnemosyne-os", entry, backend api
    dist/index.js      ← hand-written IIFE on window.__HERMES_PLUGIN_SDK__ (no build step)
    plugin_api.py      ← FastAPI router: GET /api/plugins/mnemosyne-os/status
```

## Install (verified flow, Hermes ≥ v0.20)

```bash
cp -r dashboard-plugin "$HERMES_HOME/plugins/mnemosyne-os"
hermes plugins enable mnemosyne-os --no-allow-tool-override
hermes dashboard
```

Since GHSA-mcfc-hp25-cjv7 (v0.20 line), user plugins are **allow-listed**:
assets are not served and `plugin_api.py` is not imported until the plugin
is in `plugins.enabled` (config.yaml). `--no-allow-tool-override` declines
the privileged tool-override capability non-interactively — this plugin
never needs it.

## Doc-vs-reality gaps found on first run (2026-08-12)

1. **The official "Extending the Dashboard" doc describes only
   `dashboard/`** — but the enable gate resolves plugins through the CLI
   discovery, which requires a ROOT `plugin.yaml` (name/version/
   description), and the agent-side loader wants an `__init__.py` exposing
   `register(ctx)`. A dashboard-only plugin ships a no-op register.
   Without these two files: `Plugin 'X' is not installed or bundled.`
2. **First `hermes dashboard` run builds the web UI** (`npm install
   --workspace web && npm run build -w web`) under `engine-strict=true`
   with `node >= 22.22.0`. On an older node the dashboard refuses to
   start. A manual build (with `--engine-strict=false` and their
   package-lock pins) works, but the staleness check also wants their
   content-hash stamp — write it with their own
   `hermes_cli.main._write_web_ui_build_stamp` from the venv, or just
   upgrade node.

## First-run checklist — all verified ✅ (2026-08-12, Hermes v0.20.0)

1. **SDK namespaces** ✅ — `window.__HERMES_PLUGIN_SDK__` exposes `React`,
   `hooks`, `components` (Card/CardHeader/CardTitle/CardContent/Badge/…),
   `fetchJSON`, `utils`, `useI18n` (contract v1.1.0, `web/src/plugins/
   sdk.d.ts`). Registration is `window.__HERMES_PLUGINS__.register(name,
   Component)` — the registry global, not the SDK.
2. **fetchJSON** ✅ — `SDK.fetchJSON('/api/plugins/mnemosyne-os/status')`
   injects auth in both modes; live tiles rendered real state (app
   RUNNING via 7438, brain proxy SERVING via 7439).
3. **register timing** ✅ — synchronous IIFE registers instantly; the tab
   appears in the sidebar under its manifest `position` (after:skills,
   next to Kanban).
4. **Backend route** ✅ — mounted at `/api/plugins/mnemosyne-os/` by
   `_mount_plugin_api_routes` (module must expose `router`); answers
   **401 unauthenticated** even on loopback (their dashboard_auth gate).
5. **Badge variants** ✅ — `default`/`secondary` render (shadcn).
6. **Link** ✅ — https://mnemosyne-os.com is the audience router.

## Security posture

- The backend probe is **read-only and secret-free**: two TCP connects on
  loopback (7438 REST gateway, 7439 brain proxy), no key sent, no vault
  content. Governance stays in Mnemosyne OS behind its own surfaces.
- The plugin must NEVER gain vault access — the bridge to memory is the
  MCP arrow with its covenant, not a dashboard tab.
- The agent-side entry (`__init__.py`) registers NO tools, NO hooks, and
  the tool-override capability is declined at install. The plugin's whole
  agent-side surface is `return None`.

## Distribution (unblocked — first run verified)

Git-clone channel, same as the skill tap: publish under
`Mnemosyne-OS/Mnemosyne-Neural-OS` (or a dedicated repo) and instruct
users to clone into `$HERMES_HOME/plugins/mnemosyne-os` then run
`hermes plugins enable mnemosyne-os --no-allow-tool-override`. The
enable gate (above) is Hermes' plugin trust surface; our README remains
the transparency surface: state what the backend does (loopback probes,
nothing else).

## Brand note

The id is `mnemosyne-os` on purpose (house rule: never bare "mnemosyne")
— the bare name is already used twice in the Hermes ecosystem (a
community memory provider and a clawhub skill id). The footer carries a
factual non-affiliation line.
