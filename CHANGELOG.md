# Changelog

## 0.9.2

- **MnemoHermes tells you when a new version is out.** It reads the version
  published on GitHub when its window opens, then every six hours, and shows
  a line with how to install it. The line can be hidden until the next
  version. Offline, it says nothing. Earlier versions could not do this, so
  0.9.2 is the last update you have to find by yourself.
- **A reply keeps coming when you open another tab.** Leaving Chat used to
  cancel the question in flight, so opening Status to check on Hermes lost
  the answer. The reply now runs on, a dot on the Chat tab says it is still
  coming, and it is there when you come back. The microphone is released
  and nothing is spoken while Chat is not on screen. Closing the window
  still stops the question.
- **A new setup, five steps, one question each.** Install Hermes (Next
  waits until it is there), choose what the agent may do, introduce yourself,
  link Telegram, then one Start button. The installer's raw output is behind
  "Show details" instead of filling the screen, and the texts say what each
  choice does in plain words.
- **Start plugs everything in.** It switches on the brain Mnemosyne OS lends
  to Hermes, installs the mnemosyne-memory skill, then starts the gateway and
  waits for it to answer. Each line turns green or says what went wrong. The
  separate "brain" step, a panel of switches and YAML, is gone from the
  setup (it stays in Settings).
- **Fixed: Hermes never answering after a managed install.** The installer
  pointed Hermes at the brain Mnemosyne OS lends, but that brain stayed off
  until a box on the brain step was ticked. Skipping that step left Hermes
  talking to nothing, and every chat question hung. Start now switches it
  on, and the Chat tab says when it is off, with a button to switch it on.

## 0.9.1

- **Starting the gateway no longer reports a failure while it boots.** The
  wizard's last step and the Restart button read the status once, a few
  seconds after Start, while the gateway takes 10 to 20 seconds to answer on
  Windows. They said "not running" and offered Start again, and a second
  click was refused because the gateway was already starting. Both now wait
  up to 45 seconds for the gateway to answer.

## 0.9.0 (ships with Mnemosyne OS 1.6.0)

Needs Mnemosyne OS 1.6.0 or later: the new tabs call host actions that
earlier versions do not have.

- **Install Hermes with one button**, on the Status panel and on the wizard's
  first step. The app downloads a pinned Hermes release, checks it, builds it
  and wires your memory into it. No terminal, no git.
- **Tasks with approval**: a new Tasks tab starts a run, shows its log, and
  when Hermes asks before a risky command you see the command, the reason and
  the time left, then answer once, for the session, or always. The same
  question appears as a card on your board.
- **Skills**: install the covenant skill with a button, switch any skill on
  or off, see where each one comes from, uninstall, import your own, and
  install any identifier through Hermes' own installer.
- **Channels and Tools** say who a bot is linked to, which platforms can run
  the terminal, and what a preset really ticks; Save carries the restart it
  needs, and Discard undoes an edit.
- **Memory inbox** lists only what Hermes signed, in plain words.
- **Voice**: voice notes are transcribed on your machine, and replies are
  spoken in the app's language or in the voice chosen in Settings › Voice.
- **A daily token cap** on the brain, next to the call cap. Enter saves a cap
  like leaving the field does.
- **Discussion listens and speaks**, like the Telegram bot: a microphone
  button (the host's device, lent for one question and transcribed with the
  engine chosen in Settings › Voice), and replies spoken in the voice chosen
  there — never, when you spoke, or always. Both appear only while the
  gateway is running.
- **Cards beside the chat**: an image the agent made or a document it wrote
  becomes its own card next to the conversation, with a preview and an
  “Open” button; a file that cannot be read says why.

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
