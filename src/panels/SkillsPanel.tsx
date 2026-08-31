/**
 * The Skills tab — read-only shelf (M3). Installing stays a human gesture
 * in the Hermes CLI; the covenant banner flags whether mnemosyne-memory
 * is on the shelf.
 */
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, hint, Pill, StatusDot, PanelGate, CodeBlock, cardTitle, stack } from '../ui';

interface SkillsReport {
  skills: Array<{ id: string; category: string | null; name: string | null; description: string | null }>;
  taps: string[];
  mnemosyneMemoryInstalled: boolean;
}

/** The public tap the covenant skill ships from (doc 80 §Related). */
const COVENANT_INSTALL = 'hermes skills install Mnemosyne-OS/Mnemosyne-Neural-OS/mnemosyne-memory';

export function SkillsPanel() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<SkillsReport>(
    () => sdk.invoke<SkillsReport>('hermes.skills', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(report) => (
        <div style={stack}>
          <div
            style={{
              ...panel,
              borderColor: report.mnemosyneMemoryInstalled ? 'var(--accent, #35c9a6)' : 'var(--border-subtle, #2a2a2a)'
            }}
          >
            <StatusDot on={report.mnemosyneMemoryInstalled} />
            {report.mnemosyneMemoryInstalled ? t('skills.ourInstalled') : t('skills.ourMissing')}
            {!report.mnemosyneMemoryInstalled && (
              <CodeBlock variant="snippet" style={{ margin: '10px 0 0' }}>{COVENANT_INSTALL}</CodeBlock>
            )}
          </div>

          {report.taps.length > 0 && (
            <div style={panel}>
              <h2 style={cardTitle}>{t('skills.tapsHeading')}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {report.taps.map((tap) => <Pill key={tap}>{tap}</Pill>)}
              </div>
            </div>
          )}

          <div style={panel}>
            <h2 style={{ ...cardTitle, marginBottom: 12 }}>
              {t('skills.count', { n: report.skills.length })}
            </h2>
            {report.skills.length === 0 && (
              <p style={{ ...hint, margin: 0, fontSize: 13 }}>{t('skills.empty')}</p>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {report.skills.map((s) => (
                <div key={`${s.category ?? ''}/${s.id}`} style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600 }}>{s.name ?? s.id}</span>
                  {s.category && <span style={{ marginLeft: 8 }}><Pill>{s.category}</Pill></span>}
                  {s.description && <div style={hint}>{s.description}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PanelGate>
  );
}
