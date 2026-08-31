// eslint.config.js — ESLint v9 flat config for the MnemoHermes cockpit.
//
// This cartridge drives someone else's agent: it starts processes, writes their
// config.yaml and forgets chronicles. The rules below are the ones that catch
// that class of mistake, not a style opinion:
//
//  • no-floating-promises  — an un-awaited invoke is how a config write half-runs
//  • no-empty              — a silent catch is the project's cardinal sin (CLAUDE rule 7)
//  • exhaustive-deps       — a stale closure is how a polling panel keeps
//                            reporting the state before the one it is watching
//  • no-explicit-any       — the host bridge returns `unknown` by contract, and
//                            `any` is how a payload shape silently drifts
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'dashboard-plugin/**', 'eslint.config.js', 'vite.config.ts'],
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // tsconfig.json excludes the tests so the app build does not depend on
        // the test runner. tsconfig.eslint.json includes them, which types them
        // for linting without a per-file allowlist that stops working past a
        // handful of files.
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // ── Correctness ────────────────────────────────────────────────────────
      '@typescript-eslint/no-floating-promises': 'error',
      // An async JSX handler is idiomatic React and safe here: every one of them
      // owns its try/catch and reports into the surface's own state. The
      // dangerous case — a promise nobody holds, in ordinary code — stays caught
      // by no-floating-promises above.
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // A catch that does nothing must SAY it does nothing on purpose — an
      // empty block with a comment inside is allowed, a bare `{}` is not.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // ── Honesty about async ────────────────────────────────────────────────
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // ── Noise this codebase deliberately allows ────────────────────────────
      // Template literals over unions/numbers are how every label is built.
      '@typescript-eslint/restrict-template-expressions': 'off',
      // The bridge returns `unknown` by contract; callers narrow it.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Tests reach into shapes on purpose to reproduce real bad data.
  // 🪤 {ts,tsx}: the same one-word hole that hides a rendering test from the
  // vitest glob also hides it from this override.
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // A host can reject with a bare string, and usePanelData has to classify
      // that too. Reproducing it is the test, so the rule cannot apply here.
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
);
