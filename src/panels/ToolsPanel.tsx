/**
 * The Tools tab — what the agent may do, platform by platform
 * (config.yaml `platform_toolsets`, regenerated wholesale host-side).
 *
 * What the 2026-09-23 pass changed, from the screen: a platform carrying a
 * preset drew twelve empty boxes (the truth was "everything"); the Telegram
 * bot, linked but without a block, had no row at all while Hermes hands it
 * every tool; the toolsets were raw ids; the terminal warning was painted in
 * the success colour; "restart the gateway" had no button.
 *
 * The list rules (presets, expansion, payload) live in lib/toolsets.
 */
import { useCallback, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { panel, primaryButton, buttonStyle, hint, Pill, PanelGate, FeedbackNote, cardTitle, stack, row } from '../ui';
import {
  carriesTerminal, effectiveToolsets, gridToolsets, PLATFORM_LABEL_KEYS,
  toggleToolset, toolsetsPayload, unreadPresets, unsetLinkedChannels,
} from '../lib/toolsets';
import { RestartGatewayRow } from './RestartGatewayRow';

interface ToolsData {
  platforms: Record<string, string[]>;
  available: string[];
  /** Channels the .env links (from `hermes.channels`); [] when unreadable. */
  linkedChannels: string[];
  /** True when the channel census could not be read: the "no block" rows
   *  are then unknown, not absent, and the page says so. */
  channelsUnread: boolean;
}

interface ChannelInfo { id: string; configured: boolean }

const DANGER = 'var(--danger, #d9534f)';

/** The refusals main can give on a save, each with its own sentence. */
const TOOLSETS_ERROR_CODES = ['TOOLSETS_BLOCK_UNREADABLE', 'BLOCK_NOT_FOUND', 'CONFIG_NOT_FOUND', 'INVALID_PLATFORMS'] as const;

/** Platforms that ARE this machine: a terminal there is the CLI stance, not
 *  a shell reachable from a messaging app (the warning is for the latter). */
const LOCAL_PLATFORMS = new Set(['cli', 'api_server']);

async function loadTools(): Promise<ToolsData> {
  const tools = await sdk.invoke<{ platforms: Record<string, string[]>; available: string[] }>('hermes.toolsets', {});
  let linkedChannels: string[] = [];
  let channelsUnread = false;
  try {
    const ch = await sdk.invoke<{ channels: ChannelInfo[] }>('hermes.channels', {});
    linkedChannels = ch.channels.filter((c) => c.configured).map((c) => c.id);
  } catch {
    // A page about who may do what must not pretend the bot is not there
    // because the census failed: the flag makes the panel say "unknown".
    channelsUnread = true;
  }
  return { ...tools, linkedChannels, channelsUnread };
}

export function ToolsPanel() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<ToolsData>(
    loadTools,
    /unknown action|not supported|NOT_INSTALLED|CONFIG_NOT_FOUND/i,
  );
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  // 'idle' | 'saved' | a refusal code from main ('error' when it had none).
  const [feedback, setFeedback] = useState<string>('idle');
  const [busy, setBusy] = useState(false);
  const { restart, run: restartGateway, reset: resetRestart } = useGatewayRestart();

  // Refetch drops local edits — the reloaded config is the new truth.
  const reloadClean = useCallback(() => {
    setEdits({});
    return reload(true); // silent: a loading flash would unmount the grid and jump to the top
  }, [reload]);

  /** t() hands the key back when a string is missing; an id outside the
   *  catalogue then shows itself, and has no description line. */
  const toolsetLabel = (id: string): string => {
    const key = `tools.toolset.${id}.label`;
    const s = t(key);
    return s === key ? id : s;
  };
  const toolsetDesc = (id: string): string | null => {
    const key = `tools.toolset.${id}.desc`;
    const s = t(key);
    return s === key ? null : s;
  };

  const platformLabel = (id: string): string => {
    const key = PLATFORM_LABEL_KEYS[id];
    return key ? t(key) : id;
  };

  return (
    <PanelGate state={state} onRetry={() => void reloadClean()}>
      {({ platforms, available, linkedChannels, channelsUnread }) => {
        const grid = gridToolsets(available);
        const unset = unsetLinkedChannels(platforms, linkedChannels).filter((id) => !(id in edits));
        const platformIds = [...Object.keys(platforms), ...Object.keys(edits).filter((id) => !(id in platforms))];
        if (!platformIds.length && !unset.length) return <div style={panel}>{t('tools.empty')}</div>;

        const currentOf = (id: string): string[] => edits[id] ?? platforms[id] ?? [];

        const toggle = (id: string, toolset: string) => {
          setEdits((e) => ({ ...e, [id]: toggleToolset(currentOf(id), grid, toolset) }));
          setFeedback('idle');
        };

        /** A linked channel without a block starts from what Hermes gives it
         *  today (everything), so the boxes show the truth before the person
         *  unticks; saving is what turns the red line into a chosen list. */
        const seedChannel = (id: string) => {
          setEdits((e) => ({ ...e, [id]: [...grid] }));
          setFeedback('idle');
        };

        const save = async () => {
          setBusy(true);
          setFeedback('idle');
          resetRestart();
          try {
            await sdk.invoke('hermes.toolsetsSet', { platforms: toolsetsPayload(platforms, edits) });
            setFeedback('saved');
            void reloadClean();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[cockpit] toolsets save refused:', msg);
            setFeedback(TOOLSETS_ERROR_CODES.find((c) => msg.includes(c)) ?? 'error');
          } finally {
            setBusy(false);
          }
        };

        return (
          <div style={stack}>
            <p style={{ ...hint, margin: 0 }}>{t('tools.intro')}</p>

            {channelsUnread && (
              <p style={{ ...hint, margin: 0, color: DANGER }}>{t('tools.channelsUnread')}</p>
            )}

            {unset.map((id) => (
              <div key={`unset:${id}`} style={{ ...panel, borderColor: DANGER }}>
                <div style={{ ...row, gap: 10 }}>
                  <h2 style={{ ...cardTitle, margin: 0 }}>{platformLabel(id)}</h2>
                  <span style={{ fontSize: 13, color: DANGER }}>{t('tools.noBlock')}</span>
                  <button onClick={() => seedChannel(id)} disabled={busy} style={{ ...buttonStyle, marginLeft: 'auto' }}>
                    {t('tools.noBlockFix')}
                  </button>
                </div>
              </div>
            ))}

            {platformIds.map((id) => {
              const current = currentOf(id);
              const shown = effectiveToolsets(current, grid);
              const unread = unreadPresets(current, grid);
              const presetName = current.find((x) => !grid.includes(x) && !unread.includes(x));
              const edited = id in edits;
              return (
                <div key={id} style={panel}>
                  <div style={{ ...row, gap: 10, marginBottom: 6 }}>
                    <h2 style={{ ...cardTitle, margin: 0 }}>{platformLabel(id)}</h2>
                    <Pill>{id}</Pill>
                    {unread.map((p) => <Pill key={p}>{p}</Pill>)}
                    {!LOCAL_PLATFORMS.has(id) && carriesTerminal(current) && (
                      <span style={{ fontSize: 12, color: DANGER }}>⚠ {t('tools.terminalWarning')}</span>
                    )}
                  </div>
                  {presetName && !edited && (
                    <p style={{ ...hint, margin: '0 0 10px' }}>
                      {shown.length === grid.length
                        ? t('tools.presetAll', { name: presetName })
                        : t('tools.presetSome', { name: presetName, n: shown.length })}
                      {' '}{t('tools.presetNote')}
                    </p>
                  )}
                  {unread.length > 0 && (
                    <p style={{ ...hint, margin: '0 0 10px' }}>{t('tools.presetUnknown', { name: unread.join(', ') })}</p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px 16px', fontSize: 13 }}>
                    {grid.map((toolset) => (
                      <label key={toolset} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={shown.includes(toolset)}
                          disabled={busy}
                          onChange={() => toggle(id, toolset)}
                          style={{ marginTop: 3 }}
                        />
                        <span>
                          <span style={{ color: toolset === 'terminal' && !LOCAL_PLATFORMS.has(id) ? DANGER : undefined }}>
                            {toolsetLabel(toolset)}
                          </span>
                          {toolsetDesc(toolset) && (
                            <span style={{ ...hint, display: 'block', fontSize: 11 }}>{toolsetDesc(toolset)}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={row}>
              <button onClick={() => void save()} disabled={busy || !Object.keys(edits).length} style={primaryButton}>
                {t('settings.save')}
              </button>
              {Object.keys(edits).length > 0 && (
                <button onClick={() => { setEdits({}); setFeedback('idle'); }} disabled={busy} style={buttonStyle}>
                  {t('tools.discard')}
                </button>
              )}
              {feedback === 'saved' && <FeedbackNote tone="ok">{t('tools.saved')}</FeedbackNote>}
              {feedback !== 'idle' && feedback !== 'saved' && (
                <FeedbackNote tone="note">{feedback === 'error' ? t('common.error') : t(`tools.error.${feedback}`)}</FeedbackNote>
              )}
            </div>
            {feedback === 'saved' && <RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} />}
          </div>
        );
      }}
    </PanelGate>
  );
}
