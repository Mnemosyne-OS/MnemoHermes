/* Mnemosyne OS — Hermes dashboard plugin (v0 scaffold).
 *
 * Hand-written IIFE on the dashboard's plugin SDK: React is NOT bundled,
 * everything comes from window.__HERMES_PLUGIN_SDK__ (their contract),
 * which keeps this file a few KB and immune to React version skew.
 *
 * ⚠ UNTESTED against a live dashboard — the SDK namespace assumptions
 * (components location, fetchJSON path shape) are from their docs, not
 * from a run. See ../../README.md for the first-run checklist.
 */
(function () {
  'use strict';
  var SDK = window.__HERMES_PLUGIN_SDK__;
  var REG = window.__HERMES_PLUGINS__;
  if (!SDK || !REG || typeof REG.register !== 'function') return;

  var React = SDK.React;
  var h = React.createElement;
  var hooks = SDK.hooks || React;
  var UI = SDK.components || SDK;

  /* Their shadcn primitive when exposed, a plain tag otherwise — the tab
   * must render even if the SDK surface shifts under us. */
  function ui(name, fallbackTag) {
    var C = UI[name];
    if (C) return C;
    return function (props) {
      var rest = {};
      for (var k in props) if (k !== 'children' && k !== 'variant') rest[k] = props[k];
      return h(fallbackTag || 'div', rest, props && props.children);
    };
  }

  var Card = ui('Card');
  var CardHeader = ui('CardHeader');
  var CardTitle = ui('CardTitle', 'h3');
  var CardContent = ui('CardContent');
  var Badge = ui('Badge', 'span');

  function fetchStatus() {
    if (typeof SDK.fetchJSON === 'function') {
      return Promise.resolve(SDK.fetchJSON('/api/plugins/mnemosyne-os/status'));
    }
    return fetch('/api/plugins/mnemosyne-os/status').then(function (r) { return r.json(); });
  }

  function Tile(props) {
    return h(Card, null,
      h(CardHeader, null, h(CardTitle, null, props.title)),
      h(CardContent, null,
        h(Badge, { variant: props.on ? 'default' : 'secondary' },
          props.on ? props.onLabel : props.offLabel),
        props.hint
          ? h('div', { style: { fontSize: 12, opacity: 0.7, marginTop: 6 } }, props.hint)
          : null
      )
    );
  }

  function MnemosyneTab() {
    var st = hooks.useState(null);
    var status = st[0], setStatus = st[1];

    hooks.useEffect(function () {
      var alive = true;
      function tick() {
        fetchStatus()
          .then(function (d) { if (alive) setStatus(d); })
          .catch(function () { if (alive) setStatus({ error: true }); });
      }
      tick();
      var id = setInterval(tick, 15000);
      return function () { alive = false; clearInterval(id); };
    }, []);

    var brainOn = !!(status && status.brainProxy === 'answering');
    var appOn = !!(status && status.mnemosyneApp === 'answering');

    return h('div', { style: { display: 'grid', gap: 16, padding: 16, maxWidth: 860 } },
      h('div', null,
        h('h2', { style: { margin: 0 } }, 'Mnemosyne OS'),
        h('p', { style: { opacity: 0.75, marginTop: 4 } },
          'Not a memory backend — the governed memory OS for your agent: '
          + 'vaults under a covenant, a human veto inbox, and a brain served locally.')
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 } },
        h(Tile, {
          title: 'Mnemosyne OS', on: appOn,
          onLabel: 'Running', offLabel: 'Not detected',
          hint: 'The desktop app on this machine.'
        }),
        h(Tile, {
          title: 'Brain proxy', on: brainOn,
          onLabel: 'Serving', offLabel: 'Off',
          hint: 'Hermes thinks with your OS — opt-in from the MnemoHermes cockpit (port 7439).'
        })
      ),
      h(Card, null,
        h(CardHeader, null, h(CardTitle, null, 'The memory covenant')),
        h(CardContent, null,
          h('p', { style: { marginTop: 0 } },
            'Install the mnemosyne-memory skill so this agent reads and writes '
            + 'your vaults under governance: discover before targeting, provenance '
            + 'on every write, deletion stays human.'),
          h('pre', { style: { padding: '8px 12px', borderRadius: 6, overflowX: 'auto', fontSize: 12 } },
            'hermes skills install Mnemosyne-OS/Mnemosyne-Neural-OS/mnemosyne-memory')
        )
      ),
      h(Card, null,
        h(CardHeader, null, h(CardTitle, null, 'The veto inbox')),
        h(CardContent, null,
          'Every memory your agent persists lands in a review queue in '
          + 'Mnemosyne OS — keep, move or reject, with full provenance. '
          + 'Open the MnemoHermes cockpit in Mnemosyne OS to govern it.')
      ),
      h('div', { style: { fontSize: 12, opacity: 0.6 } },
        'mnemosyne-os plugin v0.1.0 — not affiliated with the community '
        + '"mnemosyne" memory provider — https://mnemosyne-os.com')
    );
  }

  REG.register('mnemosyne-os', MnemosyneTab);
})();
