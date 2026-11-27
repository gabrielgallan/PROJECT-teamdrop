# TeamDrop — agent guide

## Context and first steps

TeamDrop is a desktop widget for sharing temporary files within teams: drag-and-drop
uploads, invitations, preview/download links, QR codes, and real-time updates.
Authentication uses Google OAuth.

This guide applies to the entire repository. Before changing anything in `api/`,
also read [api/AGENTS.md](api/AGENTS.md) for backend-specific guidance.
Treat code and scripts as the source of truth; the READMEs are introductory.

## Repository map

| Path                       | Responsibility                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `api/`                     | NestJS 11, TypeScript, Prisma 7, PostgreSQL, Redis, Azure Blob Storage, Socket.IO  |
| `app/src/`                 | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query 5                     |
| `app/src-tauri/`           | Tauri 2 and Rust (edition 2024): native sessions, credentials, files, window, tray |
| `app/tests/`               | HTTP contract and event integration tests using the Node test runner               |
| `api/test/e2e/`            | NestJS tests using Vitest, Supertest, and a real database                          |
| `biome.json`               | Shared formatting, linting, and import organization                                |
| `.github/workflows/ci.yml` | Biome checks and separate API/frontend builds                                      |

## Environment and commands

- Node: version in `.node-version` (24.22.2); CI uses pnpm 12.
- The root, `api/`, and `app/` each have their own `package.json` and
  `pnpm-lock.yaml`. Install dependencies in each required directory; there is
  no root workspace that installs or runs all projects.
- Keep pnpm and the corresponding lockfiles. Subprojects use exact dependency
  versions and engine validation in `.npmrc`.

| Working directory | Command                                                                  | Purpose                                                   |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| root              | `pnpm install --frozen-lockfile`                                         | Install shared tools                                      |
| root              | `pnpm check`                                                             | Biome: lint, formatting, and imports                      |
| root              | `pnpm check:fix`                                                         | Apply fixes; may change the entire repository             |
| `api/`            | `pnpm install --frozen-lockfile`                                         | Install backend dependencies                              |
| `api/`            | `pnpm docker:up`                                                         | Start development PostgreSQL and Redis                    |
| `api/`            | `pnpm start:dev`                                                         | Start Nest in watch mode                                  |
| `api/`            | `pnpm build`                                                             | Compile the backend                                       |
| `app/`            | `pnpm install --frozen-lockfile`                                         | Install frontend dependencies and Tauri CLI               |
| `app/`            | `pnpm dev`                                                               | Vite on port 1420; does not provide native sessions       |
| `app/`            | `pnpm tauri dev`                                                         | Run the complete desktop app                              |
| `app/`            | `pnpm build`                                                             | Typecheck and build the frontend                          |
| `app/`            | `pnpm tauri build`                                                       | Build desktop application (requires Rust/Tauri toolchain) |
| `app/`            | `node --test tests/api-contracts.test.mjs tests/files-realtime.test.mjs` | HTTP contracts and realtime tests                         |
| `app/src-tauri/`  | `cargo test`                                                             | Rust tests, including session tests                       |

Configure environments using `api/.env.example` and `app/.env.example`.
`VITE_API_URL` must point to the API without adding `/api`: adapters already
include that prefix. The app example uses port 8430, while the API example uses
3333; align these values. The API guide covers the database, migrations, and tests.

## Navigating and changing the app

Paths in this section are relative to `app/`.

- `src/app/screens`, `components`, `layouts`, and `router`: screens, components,
  and navigation; `src/global.css` contains the theme and global styles.
- `src/api/`: HTTP adapters by resource, queries, and mutations. Reuse
  `src/lib/ky.ts`, built with `src/lib/api-client.ts`, instead of duplicating
  authentication in components.
- `src/api/query-keys.ts`: cache keys include the user and team. Preserve this
  isolation and mutation invalidations; see `session-cache.ts`.
- `src/hooks/` and `src/app/providers/workspace.provider.tsx`: session
  orchestration, team selection, uploads, and workspace data.
- `src/auth/`: authentication state and login/logout lifecycle;
  `src/desktop/*.commands.ts` bridges to Rust commands registered in
  `src-tauri/src/main.rs`.
- `src-tauri/src/auth/`: API client, sessions, and credential storage. Current
  persistence depends on Windows Credential Manager. Browser authentication is
  marked as unsupported; Vite alone cannot validate this flow.
- The refresh token belongs to the native layer. Do not move its persistence
  into `localStorage` or React components. Preserve cancellation and protection
  against responses from previous sessions.
- The HTTP client retries once after `ACCESS_TOKEN_EXPIRED` and keeps generic
  retries disabled. Changes to this contract also require reviewing the Rust
  session implementation and backend error codes.
- Realtime: `src/lib/files-realtime.ts` and `src/hooks/use-files-realtime.ts`.
  Preserve teardown, reconnection when sessions/teams change, and cache
  invalidation after `files.ready`; see the API guide for events.
- Deep links use the `teamdrop` scheme; review `src/desktop/invite-links.ts`,
  `src-tauri/tauri.conf.json`, and capabilities when changing native integrations.

## Conventions and validation

- Follow English naming in code and Portuguese UI copy. TypeScript files
  predominantly use kebab-case.
- Biome: tabs, line width 80, single quotes in JS/TS, double quotes in JSX,
  semicolons only when needed, and trailing commas. Refer to `biome.json`.
- Make changes in the responsible module and preserve existing local changes.
  Do not edit generated output: `dist/`, `target/`, `gen/`, or the Prisma client.
- Contract changes must align API DTOs/presenters, app adapters and types,
  events, and relevant tests.
- Validate proportionally: run `pnpm check` at the root and build the affected
  project; Rust changes also require Cargo checks/tests. Current CI does not run
  E2E tests, Node tests, or the native Tauri build.
- `app/tests/files-realtime.test.mjs` has an outdated import pointing to
  `api/src/modules/auth/services/access-token.service.ts`; the current file is
  under `application/`. That test's membership fixture also lacks
  `team.storageRetentionSeconds`, which uploads use. Account for these issues
  when diagnosing failures; do not assume the build covers these tests.
- Never include `.env` credentials, tokens, or connection strings in code,
  documentation, or logs. Report what was validated and any blockers.

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->
