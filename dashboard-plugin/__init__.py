"""Mnemosyne OS — dashboard-only plugin.

The agent-side loader requires every enabled directory plugin to expose
``register(ctx)``. This plugin extends the DASHBOARD only (tab + loopback
liveness probe); it deliberately registers no tools, no hooks, and no
middleware on the agent. Memory access stays on the MCP arrow under the
mnemosyne-memory skill covenant — never through a dashboard plugin.
"""


def register(ctx):  # noqa: ARG001 — the loader's required entry point
    return None
