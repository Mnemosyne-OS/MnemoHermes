# Changelog

## 0.8.0 (2026-08-31)

First public release. The cockpit itself has been in the monorepo since
2026-08-12; this is the version that leaves it.

### What it does

- **Status** of the local Hermes install: home directory, `api_server`, and the
  gateway, with start and stop and the process's own journal.
- **Discussion** with the agent through its `api_server`, streaming token by
  token, with a Stop button and a slash-command cheat sheet.
- **Agents**, one card per Hermes profile, each with its own Telegram token and
  its own gateway.
- **Channels**, a census of the configured messaging platforms plus the one
  form the cockpit can write.
- **Tools**, the per-platform toolset grid, which flags a messaging platform
  that carries a terminal.
- **Skills**, the read-only shelf, with a flag for whether the covenant skill
  is installed.
- **Inbox**, every memory the agent wrote into your vaults, under keep / move /
  reject with full provenance.
- **Brain**, the loopback proxy that serves Mnemosyne's inference to Hermes,
  with a daily call cap and today's real spend.
- **Security presets**, Fortress / Balanced / YOLO, written to both sides of
  the bridge in one gesture.
- Seven languages, at key parity.

### Known gaps, stated rather than discovered

- The profile screen writes `USER.md`, and Hermes carries a
  `user_profile_enabled` flag that the cockpit does not read. With that flag
  off, the file is never injected into the prompt and the screen reports a
  success that changed nothing. Being fixed; until it is, check the flag
  yourself.
- The same applies to `memory.memory_enabled`. When Mnemosyne serves the memory
  through MCP, Hermes' own memory can keep running in parallel and spend tokens
  on it. The cockpit neither shows nor measures that.
- Whether disabling the `memory` toolset from the Tools tab also cuts Hermes'
  access to Mnemosyne's MCP tools is **not measured**. The screen says nothing
  about it on purpose.
- Nobody has checked that the cockpit's idea of the current session survives
  Hermes' `/new`, `/resume`, `/branch`, an undo, or a context compaction.

### Engineering

- 145 tests over 10 files, mutation-checked. Typecheck, lint and build are
  gates, not suggestions.
- The rules live in `src/lib/` as pure modules: error-code classification, the
  dashboard reduction, the gateway phase, the toolset grid, formatting, and the
  Hermes config strings.
