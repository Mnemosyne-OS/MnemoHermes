/**
 * The Tools tab — per-platform toolsets editor (config.yaml
 * platform_toolsets, regenerated wholesale host-side). The security posture
 * lives in the DATA: a messaging platform carrying a terminal gets flagged.
 * The list rules (presets vs explicit toolsets) live in lib/toolsets.
 */
import { useCallback, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, buttonStyle, hint, Pill, PanelGate, FeedbackNote, cardTitle, stack, row } from '../ui';
import { carriesTerminal, presetToolsets, toggleToolset, toolsetsPayload } from '../lib/toolsets';

interface ToolsData {
  platforms: Record<string, string[]>;
  available: string[];
}

export function ToolsPanel() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<ToolsData>(
    () => sdk.invoke<ToolsData>('hermes.toolsets', {}),
    /unknown action|not supported|NOT_INSTALLED|CONFIG_NOT_FOUND/i,
  );
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);

  // Refetch drops local edits — the reloaded config is the new truth.
  const reloadClean = useCallback(() => {
    setEdits({});
    return reload();
  }, [reload]);

  return (
    <PanelGate state={state} onRetry={() => void reloadClean()}>
      {({ platforms, available }) => {
        const platformIds = Object.keys(platforms);
        if (!platformIds.length) return <div style={panel}>{t('tools.empty')}</div>;

        const currentOf = (id: string): string[] => edits[id] ?? platforms[id] ?? [];

        const toggle = (id: string, toolset: string) => {
          setEdits((e) => ({ ...e, [id]: toggleToolset(currentOf(id), available, toolset) }));
          setFeedback('idle');
        };

        const save = async () => {
          setBusy(true);
          setFeedback('idle');
          try {
            await sdk.invoke('hermes.toolsetsSet', { platforms: toolsetsPayload(platforms, edits) });
            setFeedback('saved');
            void reloadClean();
          } catch {
            setFeedback('error');
          } finally {
            setBusy(false);
          }
        };

        return (
          <div style={stack}>
            <p style={{ ...hint, margin: 0 }}>{t('tools.intro')}</p>
            {platformIds.map((id) => {
              const current = currentOf(id);
              const presets = presetToolsets(current, available);
              return (
                <div key={id} style={panel}>
                  <div style={{ ...row, gap: 10, marginBottom: 10 }}>
                    <h2 style={{ ...cardTitle, margin: 0 }}>{id}</h2>
                    {presets.map((p) => <Pill key={p}>{p}</Pill>)}
                    {id !== 'cli' && carriesTerminal(current) && (
                      <span style={{ fontSize: 12, color: 'var(--accent, #35c9a6)' }}>
                        ⚠ {t('tools.terminalWarning')}
                      </span>
                    )}
                  </div>
                  {presets.length > 0 && (
                    <p style={{ ...hint, margin: '0 0 10px' }}>{t('tools.presetNote')}</p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13 }}>
                    {available.map((toolset) => (
                      <label key={toolset} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={current.includes(toolset)}
                          disabled={busy}
                          onChange={() => toggle(id, toolset)}
                        />
                        {toolset}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={row}>
              <button onClick={() => void save()} disabled={busy || !Object.keys(edits).length} style={buttonStyle}>
                {t('settings.save')}
              </button>
              {feedback === 'saved' && <FeedbackNote tone="ok">{t('tools.saved')}</FeedbackNote>}
              {feedback === 'error' && <FeedbackNote tone="note">{t('common.error')}</FeedbackNote>}
            </div>
          </div>
        );
      }}
    </PanelGate>
  );
}
