import {
  chatErrorKey,
  errorMessage,
  matchCode,
  searchFeedback,
  telegramFeedback,
  CHAT_ERROR_KEYS,
  SEARCH_FEEDBACK_KEYS,
  SEARCH_FEEDBACK_TEXT,
  TELEGRAM_FEEDBACK_TEXT,
} from './errorCodes';

describe('errorMessage', () => {
  it('reads an Error', () => {
    expect(errorMessage(new Error('GATEWAY_NOT_RUNNING'))).toBe('GATEWAY_NOT_RUNNING');
  });

  it('stringifies anything else, including what a rejected bridge call throws', () => {
    expect(errorMessage('AUTH_FAILED')).toBe('AUTH_FAILED');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage({ code: 42 })).toBe('[object Object]');
  });
});

describe('matchCode', () => {
  it('returns the first matching entry, not the longest', () => {
    const table = [['A', 'first'], ['AB', 'second']] as const;
    expect(matchCode(table, 'xxABxx', 'none')).toBe('first');
  });

  it('falls back when nothing matches', () => {
    expect(matchCode([['A', 1]] as const, 'zzz', -1)).toBe(-1);
  });

  it('matches on a substring of a longer host message', () => {
    expect(matchCode([['TIMEOUT', 'k']] as const, 'Error: request TIMEOUT after 180s', 'x')).toBe('k');
  });
});

describe('chatErrorKey', () => {
  it.each([
    ['GATEWAY_NOT_RUNNING', 'chat.errNotRunning'],
    ['API_SERVER_DISABLED', 'chat.errDisabled'],
    ['NOT_INSTALLED', 'chat.errNotInstalled'],
    ['AUTH_FAILED', 'chat.errAuth'],
    ['TIMEOUT', 'chat.errTimeout'],
  ])('%s maps to %s', (code, key) => {
    expect(chatErrorKey(code)).toBe(key);
  });

  it('does not invent a sentence for a code the taxonomy has not named', () => {
    expect(chatErrorKey('ECONNRESET')).toBe('common.error');
    expect(chatErrorKey('')).toBe('common.error');
  });

  it('keeps GATEWAY_NOT_RUNNING ahead of any shorter code it contains', () => {
    // The two are distinct diagnoses: "your agent is not running" sends the
    // reader to a Start button, "you have no Hermes" sends them to an install.
    // Ordering these the other way round would answer the wrong question.
    const codes = CHAT_ERROR_KEYS.map(([c]) => c);
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const later = codes[j];
        // A later code that is a substring of an earlier one is fine (the
        // earlier wins on purpose). The reverse would make the later entry
        // unreachable, so it must not happen.
        expect(codes[i].includes(later) && later.includes(codes[i])).toBe(false);
      }
    }
    expect(chatErrorKey('GATEWAY_NOT_RUNNING')).not.toBe('chat.errNotInstalled');
  });
});

describe('searchFeedback', () => {
  it.each([
    ['DOCKER_NOT_INSTALLED', 'dockerInstall'],
    ['DOCKER_NOT_RUNNING', 'dockerStart'],
    ['SEARXNG_NOT_SET_UP', 'notSetUp'],
    ['ENGINE_STARTING', 'starting'],
    ['ENGINE_NOT_ANSWERING', 'notAnswering'],
  ] as const)('%s maps to %s', (code, verdict) => {
    expect(searchFeedback(code)).toBe(verdict);
  });

  it('treats an unrecognised failure as a plain error', () => {
    expect(searchFeedback('boom')).toBe('error');
  });

  it('keeps "Docker is missing" apart from "Docker is not running"', () => {
    // Same word, two different instructions. Merging them sends someone to
    // install software they already have.
    expect(searchFeedback('DOCKER_NOT_INSTALLED')).not.toBe(searchFeedback('DOCKER_NOT_RUNNING'));
  });

  it('has a sentence for every verdict it can produce', () => {
    for (const [, verdict] of SEARCH_FEEDBACK_KEYS) {
      expect(SEARCH_FEEDBACK_TEXT[verdict]).toBeTruthy();
    }
    expect(SEARCH_FEEDBACK_TEXT.error).toBeTruthy();
    expect(SEARCH_FEEDBACK_TEXT.done).toBeTruthy();
  });
});

describe('telegramFeedback', () => {
  it('separates a malformed token from malformed user ids', () => {
    expect(telegramFeedback('INVALID_TOKEN')).toBe('invalidToken');
    expect(telegramFeedback('INVALID_USER_IDS')).toBe('invalidIds');
  });

  it('falls back to a plain error', () => {
    expect(telegramFeedback('EPERM')).toBe('error');
  });

  it('has a sentence for every settled verdict', () => {
    for (const verdict of ['saved', 'invalidToken', 'invalidIds', 'error'] as const) {
      expect(TELEGRAM_FEEDBACK_TEXT[verdict]).toBeTruthy();
    }
  });
});
