# Pinto project instructions

- Pinto is a TypeScript SDK for Pinterest, and its planned API includes write actions such as posting and following. Do not assume the project is read-only; review each action against its intended API behavior and avoid unintended external side effects.
- Follow the existing module layout documented in `CONTRIBUTING.md`. Make implementation changes in `src/` or `Pinth/`; `lib/` is generated build output.
- Keep public API types and ESM/CJS builds working. Add or update offline tests in `src/_test_/` for behavior changes; do not make standard tests depend on live Pinterest access or credentials.
- Preserve existing pagination, normalization, session, cache, retry, and rate-limit behavior unless the change explicitly intends to alter it. Handle invalid input and failures explicitly rather than silently returning success-shaped defaults.
- Before considering a code change complete, run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`.
- In code reviews, report only actionable issues supported by the code. Explain the affected behavior and cite the relevant file or symbol; do not treat stylistic preferences or speculative concerns as bugs.
- Keep tests deterministic and offline by mocking network interactions, including tests for actions that change a user's Pinterest account.
