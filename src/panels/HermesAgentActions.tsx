/**
 * Serves MnemoHermes' agent actions (doc 149) while the cockpit is open.
 *
 * A CHILD that renders nothing, never a hook in App: App is mounted on the
 * person's board while the app runs, and a hook added to it breaks the order
 * of its hooks under hot reload. The handlers live in `lib/hermesAgent.ts`;
 * this only keeps their view of the cockpit fresh (a ref written every render)
 * and subscribes ONCE.
 */
import { useEffect, useRef } from 'react';
import { sdk } from '../sdk/instance';
import { getLang } from '../i18n/useI18n';
import { hermesAgentHandlers, type HermesAgentContext } from '../lib/hermesAgent';

type Props = Omit<HermesAgentContext, 'invoke' | 'locale'>;

export function HermesAgentActions(props: Props) {
  const latest = useRef<HermesAgentContext>({ ...props, invoke: (action, payload) => sdk.invoke(action, payload), locale: getLang });
  latest.current = { ...props, invoke: (action, payload) => sdk.invoke(action, payload), locale: getLang };

  useEffect(() => {
    if (typeof sdk.onAgentActions !== 'function') {
      // An iframe served an older SDK build: it must not take the window down.
      console.warn('[MnemoHermes] this SDK build has no onAgentActions; reload the cartridge to serve agent actions');
      return undefined;
    }
    const sub = sdk.onAgentActions(hermesAgentHandlers(() => latest.current));
    sub.ready.catch((err: unknown) => console.warn('[MnemoHermes] agent actions not served:', err instanceof Error ? err.message : err));
    return () => sub.off();
  }, []);

  return null;
}
