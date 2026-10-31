# Contributing to Pinto

Pinto is a read-only automation and scraping SDK for Pinterest, published as [`@traceryn/pinto`](https://www.npmjs.com/package/@traceryn/pinto).

## How to contribute

1. Fork the repo and create a branch from `master`
2. Make your change
3. Run the quality gate: `npm run typecheck && npm test && npm run build`
4. Commit using conventional commits (see below)
5. Open a pull request against `master`

## Development

### Setup

```bash
npm ci
```

Requires Node.js `>=18` (engines field in `package.json`).

### Scripts

| Script | Purpose |
|---|---|
| `npm run typecheck` | TypeScript typecheck (`tsc --noEmit`) |
| `npm test` | Offline Jest suite (43 tests, no network) |
| `npm run lint` | ESLint across the repo |
| `npm run build` | Dual ESM + CJS build plus package markers |
| `npm run example` | Run `Example/example.ts` against live Pinterest |
| `npm run release` | Bump version, changelog, commit, tag via `release-it` |

### Project layout

```
src/           TypeScript source
  Actions/     Public API (search, boardPins, userPins, getPin, getUser, getBoard)
  Client/      HTTP transport, caching, retries, rate limiting
  Config/      Constants (page sizes, timeouts, backoff)
  Errors/      Error classes
  Harvest/     Normalization: raw payloads → typed shapes
  Media/       Format detection (image/video/mime)
  Scale/       Session pool, cache, gateway, rate limiter
  Vault/       Sessions, cookies, devices, bootstrap
  _test_/      Offline Jest tests (*.test.ts)
Pinth/         Pinterest wire layer (URLs, feed/widget envelopes, headers)
lib/           Build output (esm + cjs) — gitignored
Example/       Single runnable example (example.ts)
```

### Code style

- TypeScript strict mode
- 2-space indentation, double quotes, semicolons
- ESLint flat config (`eslint.config.mjs`) — run `npm run lint`
- No `console.log` in source outside of scripts/examples

## Testing

### Offline suite

```bash
npm test
```

Runs `jest` against `src/_test_/*.test.ts`. No network, no credentials required. These must stay green on every commit.

### Live e2e suite

`src/_test_/*.test-e2e.ts` hit real Pinterest endpoints and require authenticated cookies. They are **not** part of `npm test` — run them manually only when you have valid session cookies stored locally.

## Releasing

Pinto is released from `master` as `v*` tags. The release pipeline is:

```bash
npm run release -- --preRelease=pre   # bump + changelog + commit + tag v1.0.0-pre.N
git push --follow-tags                 # triggers CI: test → lint → build → npm publish → GitHub Release
```

- `release-it` reads `.release-it.json` and bumps the version in `package.json`
- `auto-changelog` updates `CHANGELOG.md` via the `after:bump` hook
- `prepublishOnly` (`typecheck && test && build`) runs before every publish
- Publishing authenticates via npm OIDC trusted publisher — no long-lived token secret in CI

### Version numbering

- Pre-releases: `1.0.0-pre.N` → `npm run release -- --preRelease=pre`
- Stable: `1.0.0` → `npm run release` (no flags)
- Tags must match `package.json` version exactly (e.g. `v1.0.0-pre.12`)

## Commit messages

Use conventional commits:

```
feat(pagination): stable cursors across search scopes
fix(normalization): decode HTML entities in board names
docs(readme): add search pagination example
chore(release): v1.0.0-pre.12
```

Scopes used in this repo: `pagination`, `normalization`, `search`, `media`, `scale`, `vault`, `ci`, `release`, `docs`, `test`, `infra`.

## Issues & roadmap

Feature requests and bug reports use the templates in `.github/ISSUE_TEMPLATE/`. Planned work is tracked on the [Pinto Roadmap](https://github.com/orgs/Traceryn/projects/5) project board.

## Security

See [`SECURITY.md`](SECURITY.md) for disclosure policy. Pinto is read-only — it cannot post, follow, save, or message on your behalf.