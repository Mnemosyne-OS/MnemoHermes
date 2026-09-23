/**
 * The row under a "saved" note: one button that restarts the gateway and a
 * verdict beside it. Shared by Channels and Tools, which both write config
 * the gateway only reads at start.
 */
import { useI18n } from '../i18n/useI18n';
import { buttonStyle, FeedbackNote, row } from '../ui';
import type { RestartState } from '../hooks/useGatewayRestart';

export function RestartGatewayRow({ restart, onRestart }: { restart: RestartState; onRestart: () => void }) {
  const { t } = useI18n();
  return (
    <div style={row}>
      <button onClick={onRestart} disabled={restart === 'running'} style={buttonStyle}>
        {restart === 'running' ? t('common.restarting') : t('common.restartGateway')}
      </button>
      {restart === 'ok' && <FeedbackNote tone="ok">{t('common.restarted')}</FeedbackNote>}
      {restart === 'failed' && <FeedbackNote tone="note">{t('common.restartFailed')}</FeedbackNote>}
    </div>
  );
}
