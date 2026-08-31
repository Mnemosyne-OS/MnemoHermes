/**
 * Wizard step — the agent profile (USER.md). Three modes converge on ONE
 * human-reviewed textarea: Mnemosyne pre-fill (inferModel + RAG), the
 * localized template, free paste. Never written without human eyes.
 */
import { useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, type LangCode } from '../i18n/useI18n';
import { inputStyle, buttonStyle } from '../ui';

/** Output language of the pre-fill — every language the shell can hand us. */
const LANG_NAMES: Record<LangCode, string> = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  pt: 'Portuguese', ru: 'Russian', zh: 'Simplified Chinese',
};

export function ProfileStep() {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState('');
  const [limit, setLimit] = useState(1375);
  const [autofilling, setAutofilling] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await sdk.invoke<{ content: string | null; charLimit: number }>('hermes.profileGet', {});
        if (cancelled) return;
        setProfile(data.content ?? '');
        setLimit(data.charLimit);
      } catch {
        // Not installed / outside host — the textarea still works for drafting.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const autofill = async () => {
    setAutofilling(true);
    setFeedback('idle');
    try {
      const langName = LANG_NAMES[lang];
      // A model prompt, not a UI string: instructions stay English, the
      // OUTPUT follows the shell language. Grounded-only by instruction —
      // and by the human review below either way.
      const raw = await sdk.inferModel({
        prompt:
          'Draft the USER.md profile a personal agent will use to know its human. '
          + 'From the retrieved memory only, write a concise profile: role, technical stack, '
          + 'interaction style preferences, what they expect from an agent, current projects. '
          + `No invention — omit what the memory does not support. Max ${limit} characters. `
          + `Write it in ${langName}.`,
        ragQuery: 'profil utilisateur rôle stack technique préférences style projets en cours '
          + '/ user profile role technical stack preferences interaction style current projects',
        maxTokens: 700,
      }) as unknown;
      const text = typeof raw === 'string' ? raw : ((raw as { text?: string })?.text ?? '');
      if (text.trim()) setProfile(text.trim().slice(0, limit));
      else setFeedback('error');
    } catch {
      setFeedback('error');
    } finally {
      setAutofilling(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setFeedback('idle');
    try {
      await sdk.invoke('hermes.profileSet', { content: profile });
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.profile.body')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => void autofill()}
          disabled={autofilling || busy}
          style={{ ...buttonStyle, borderColor: 'var(--accent, #35c9a6)' }}
        >
          {autofilling ? t('onboarding.profile.autofilling') : t('onboarding.profile.autofill')}
        </button>
        <button
          onClick={() => { setProfile(t('onboarding.profile.templateText')); setFeedback('idle'); }}
          disabled={autofilling || busy}
          style={buttonStyle}
        >
          {t('onboarding.profile.template')}
        </button>
      </div>
      <textarea
        value={profile}
        onChange={(e) => { setProfile(e.target.value); setFeedback('idle'); }}
        rows={12}
        placeholder={t('onboarding.profile.placeholder')}
        style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: profile.length > limit ? 'var(--accent, #35c9a6)' : 'var(--text-muted, #666)' }}>
          {t('onboarding.profile.counter', { n: profile.length, max: limit })}
        </span>
        <button
          onClick={() => void apply()}
          disabled={busy || autofilling || !profile.trim()}
          style={{ ...buttonStyle, borderColor: 'var(--accent, #35c9a6)' }}
        >
          {t('onboarding.profile.apply')}
        </button>
        {feedback === 'saved' && (
          <span style={{ fontSize: 12, color: 'var(--accent, #35c9a6)' }}>{t('onboarding.profile.applied')}</span>
        )}
        {feedback === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{t('common.error')}</span>
        )}
      </div>
    </div>
  );
}
