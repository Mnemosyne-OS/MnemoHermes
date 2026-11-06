import { guardLines, MOLI_WRITTEN_TEXT, offersRestart, verdictLines, writesAfter, type MoliProbe } from './moli';
import { moliFault, MOLI_FAULT_TEXT } from './errorCodes';
import { translate } from '../i18n/useI18n';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import es from '../i18n/locales/es.json';
import de from '../i18n/locales/de.json';
import pt from '../i18n/locales/pt.json';
import ru from '../i18n/locales/ru.json';
import zh from '../i18n/locales/zh.json';

const VERDICTS: MoliProbe[] = [
  { verdict: 'moli', version: '0.1.0', devices: 123, protectedRooms: ['Sécurité'], protectUnassigned: false },
  { verdict: 'refused' },
  { verdict: 'noAnswer' },
  { verdict: 'unreachable', code: 'EHOSTUNREACH' },
  { verdict: 'hostRefused' },
  { verdict: 'notMoli', status: 200 },
];

describe('writesAfter', () => {
  it('links a Moli that is off right now: the entry carries a 5 s connect timeout', () => {
    expect(writesAfter({ verdict: 'moli' })).toBe(true);
    expect(writesAfter({ verdict: 'refused' })).toBe(true);
    expect(writesAfter({ verdict: 'noAnswer' })).toBe(true);
    expect(writesAfter({ verdict: 'unreachable', code: 'EHOSTUNREACH' })).toBe(true);
  });

  it('never writes a door that answered and is not Moli, or Moli refusing it', () => {
    expect(writesAfter({ verdict: 'notMoli' })).toBe(false);
    expect(writesAfter({ verdict: 'hostRefused' })).toBe(false);
  });
});

describe('verdictLines', () => {
  it('says what Moli said about itself, and only that', () => {
    expect(verdictLines('127.0.0.1:8790', VERDICTS[0])).toEqual([
      { key: 'moli.found', vars: { address: '127.0.0.1:8790' } },
      { key: 'moli.foundVersion', vars: { version: '0.1.0' } },
      { key: 'moli.foundDevices', vars: { devices: 123 } },
    ]);
    // Absent fields stay absent: no "0 devices", no "Version undefined".
    expect(verdictLines('127.0.0.1:8790', { verdict: 'moli' })).toEqual([
      { key: 'moli.found', vars: { address: '127.0.0.1:8790' } },
    ]);
  });

  it('gives each failure its own sentence, with the address', () => {
    const keys = VERDICTS.slice(1).map((p) => verdictLines('10.0.0.5:8790', p)[0]?.key);
    expect(keys).toEqual(['moli.refused', 'moli.noAnswer', 'moli.unreachable', 'moli.hostRefused', 'moli.notMoli']);
    expect(verdictLines('10.0.0.5:8790', VERDICTS[3])[0]?.vars).toEqual({ address: '10.0.0.5:8790', code: 'EHOSTUNREACH' });
  });
});

describe('guardLines', () => {
  it('names the protected rooms Moli reported', () => {
    expect(guardLines({ verdict: 'moli', protectedRooms: ['Chambre de Léa', 'Sécurité'] }))
      .toEqual([{ key: 'moli.rooms', vars: { rooms: 'Chambre de Léa, Sécurité' } }]);
  });

  it('says "no protection at all" only when Moli SAID both halves', () => {
    expect(guardLines({ verdict: 'moli', protectedRooms: [], protectUnassigned: false }))
      .toEqual([{ key: 'moli.noRooms' }]);
    // An older Moli without protect_unassigned: an empty room list proves nothing.
    expect(guardLines({ verdict: 'moli', protectedRooms: [] })).toEqual([]);
    expect(guardLines({ verdict: 'moli', protectedRooms: [], protectUnassigned: true }))
      .toEqual([{ key: 'moli.unassignedProtected' }]);
    expect(guardLines({ verdict: 'moli' })).toEqual([]);
    expect(guardLines({ verdict: 'refused' })).toEqual([]);
  });
});

describe('offersRestart', () => {
  it('asks for a gateway restart only when the file changed', () => {
    expect(offersRestart('saved')).toBe(true);
    expect(offersRestart('unlinked')).toBe(true);
    expect(offersRestart('unchanged')).toBe(false);
    expect(offersRestart('notSaved')).toBe(false);
    expect(offersRestart('idle')).toBe(false);
  });
});

describe('moliFault', () => {
  it('maps each address refusal of the host to its own sentence', () => {
    expect(moliFault('MOLI_ADDRESS_NAME')).toBe('name');
    expect(moliFault('Error: MOLI_ADDRESS_PUBLIC')).toBe('public');
    expect(moliFault('MOLI_ADDRESS_INVALID')).toBe('invalid');
    expect(moliFault('MOLI_ADDRESS_EMPTY')).toBe('empty');
    expect(moliFault('NOT_INSTALLED')).toBe('notInstalled');
    expect(moliFault('EACCES: permission denied')).toBe('error');
  });
});

describe('Moli locale keys', () => {
  const bundles = { en, fr, es, de, pt, ru, zh } as Record<string, Record<string, unknown>>;
  const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
    key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), bundle);

  const used = [
    ...VERDICTS.flatMap((p) => [...verdictLines('a', p), ...guardLines(p)].map((l) => l.key)),
    'moli.noRooms', 'moli.unassignedProtected',
    ...Object.values(MOLI_WRITTEN_TEXT),
    ...Object.values(MOLI_FAULT_TEXT),
  ];

  it('every key the panel can show exists in all seven languages', () => {
    for (const [lang, bundle] of Object.entries(bundles)) {
      for (const key of used) expect(typeof lookup(bundle, key), `${lang} ${key}`).toBe('string');
    }
  });

  it('every language carries the same moli keys and the same placeholders', () => {
    const enMoli = en.moli as Record<string, string>;
    const holes = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join();
    for (const [lang, bundle] of Object.entries(bundles)) {
      const moli = bundle.moli as Record<string, string>;
      expect(Object.keys(moli).sort(), lang).toEqual(Object.keys(enMoli).sort());
      for (const k of Object.keys(enMoli)) expect(holes(moli[k] ?? ''), `${lang} moli.${k}`).toBe(holes(enMoli[k] ?? ''));
    }
  });

  it('fills the address into the sentence', () => {
    expect(translate('moli.refused', { address: '127.0.0.1:8790' })).toContain('127.0.0.1:8790');
  });
});
