# TeamDrop API — backend guide

Also read [../AGENTS.md](../AGENTS.md). This guide covers `api/` specifically.
Run the commands below from this directory.

## Architecture and entry points

NestJS 11 API on Express, with strict TypeScript and ESM (`NodeNext`, ES2024
target). Persistence uses Prisma 7 with the PostgreSQL adapter; Redis stores
login tickets; Azure Blob Storage stores files; Socket.IO delivers notifications.

| Path                   | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `src/main.ts`          | HTTP bootstrap, CORS, port, and API reference              |
| `src/app.module.ts`    | Modules, global Zod validation, rate limiting, scheduler   |
| `src/modules/auth/`    | Google OAuth, desktop tickets, JWT, sessions, profile      |
| `src/modules/teams/`   | Teams, members, ownership, retention                       |
| `src/modules/invites/` | Invitations and the public page that opens the app         |
| `src/modules/files/`   | Uploads, listing, URLs, deletion, expiration job           |
| `src/infrastructure/`  | Database, environment, cache, storage, websocket, health   |
| `src/common/`          | Cryptography, utilities, shared HTTP resources             |
| `prisma/schema.prisma` | Models and constraints; migrations in `prisma/migrations/` |
| `test/e2e/`            | Authentication suite using AppModule and real dependencies |

Each feature has `<feature>.module.ts`, `application/`, and `presentation/`.
`auth/` also has `infrastructure/`; `files/` has `jobs/`.

## Implementation patterns

1. Controllers in `presentation/` handle transport: HTTP decorators,
   body/params/query validation, `@CurrentUser()`, status codes, and responses.
2. DTOs in `presentation/dtos/` use Zod and `createZodDto` from `nestjs-zod`.
   `ZodValidationPipe` is global. Document operations and responses with
   `@nestjs/swagger` decorators; `/reference` uses Scalar, with OpenAPI processed
   by `cleanupOpenApiDoc` in `src/config/api-reference/`.
3. Services in `application/` receive typed objects from `*.types.ts`, enforce
   authorization/business rules, and access `PrismaService` directly. There is
   no separate repository or domain entity layer to replicate.
4. Static presenters convert results to HTTP responses and remove internal
   fields. For files, convert `size` from BigInt to Number and avoid accidentally
   exposing `storageKey`, `authorId`, or `teamId`.
5. Use Nest dependency injection and register imports/providers/exports in the
   module. Cache and storage use interfaces with Symbol tokens:
   `@Inject(CacheService) ICacheService` and
   `@Inject(StorageService) IStorageService`.
6. Local backend imports use the `.js` extension, even in `.ts` files.
   Preserve class imports required for DI/decorator metadata.
7. Errors use Nest exceptions (`NotFoundException`, `ConflictException`, etc.)
   with messages and, for authentication, codes consumed by the app. Preserve
   404 semantics for resources that do not exist or are inaccessible to the user.
8. Configuration goes through `EnvService` and the Zod schema in
   `src/infrastructure/env/env.ts`. When adding a variable, also update
   `.env.example` and test setup.

## Authentication and contract security

- `AccessTokenGuard` is global through `AuthModule`; public routes require
  `@Public()`. Obtain identity through `@CurrentUser()`, never from the body as
  proof of authorization. Check membership/ownership in services or queries.
- Desktop flow: `POST /api/auth/desktop/start` receives a challenge; Google
  OAuth returns to `GET /api/auth/google/callback`; the desktop polls
  `POST /api/auth/desktop/exchange` with the ticket and verifier.
- `DesktopTicketService`: Redis tickets initially last 300s; completion changes
  the TTL to 60s. Proof is validated before atomic consumption through `getDel`.
  Preserve single use and replay protection.
- Access token: HS256 JWT, issuer/audience `teamdrop-api`, claims `sub` and `sid`,
  valid for up to 15min, bounded by session expiration.
- Sessions last 30 days. Only the refresh token hash is stored in the database;
  rotation conditionally replaces that hash without extending the original
  deadline. Only one concurrent attempt must succeed. Logout revokes the session
  using the refresh token.
- The guard checks signatures/claims without querying the database session on
  every request; do not assume immediate revocation of issued access tokens.
- Preserve `ACCESS_TOKEN_EXPIRED`, `INVALID_ACCESS_TOKEN`, and
  `INVALID_REFRESH_TOKEN`: the app uses these codes to choose between token
  renewal and signing in again.
- Global HTTP rate limits: 5 req/s, 30 req/10s, and 100 req/min, with possible
  endpoint overrides. Review polling when changing authentication limits.

## Business rules to preserve

- **Teams:** a user can belong to up to 5 teams; creation adds the owner as a
  member. Slugs are unique. Only owners can update teams/remove members; owners
  cannot leave or remove themselves. On removal, `memberId` is the user's ID.
- **Retention:** team `storageRetentionSeconds` ranges from 900 to 259200s
  (15min to 72h), default 86400s. `expiresAt` is calculated on upload; changing
  retention does not recalculate existing file expiration dates.
- **Invitations:** tokens are stored as hashes, with expiration, usage limits,
  and revocation. Creating a new invitation revokes previous ones.
  Creation/revocation locks the team; acceptance locks the user and team within
  a transaction. Preserve atomicity, team limits, and idempotency for existing
  members.
- **Uploads:** multipart with a `file` field, received in memory by Multer.
  Membership is required; the blob is written to `teams/{teamId}/{uuidv7}` before
  the database record. Storage failures during upload/deletion become 503 errors.
  There is no distributed transaction between Azure and PostgreSQL; account for
  this ordering when changing the flow.
- **Listing:** only unexpired files; descending UUIDv7 cursor, fetching
  `limit + 1` and returning `{ files, nextCursor }`.
- **URLs:** the user must belong to the team and the file must not be expired.
  Azure generates a read SAS valid for 5min for `preview` or `download`.
  `GET /api/files/:fileId/preview` requires authentication and redirects;
  `POST /api/files/:fileId/url?type=...` returns `{ url }`.
- **Deletion:** the query restricts the file by author and team; the blob is
  deleted before the record, and an event is emitted after success.
- **Expiration:** a job runs every 5min with `waitForCompletion`; it processes
  batches of 100 with concurrency 5 and removes database records only after
  successful blob deletion. Cleanup currently emits no deletion events. The job
  lock is local to each instance, not distributed.

## HTTP and realtime

There is no global prefix: controllers declare complete paths.

- `/api/auth`: desktop start/exchange, Google callback, refresh, logout, and profile.
- `/api/teams`: create/list, update, and manage members.
- `/api/invites`: create/revoke, inspect `:token`, and accept `:token/accept`.
- `/invites/:token`: public HTML page for opening an invitation in the desktop app.
- `/api/teams/:teamId/files`: upload/list, with deletion at `/:fileId`.
- `/api/files/:fileId`: preview and URL generation; `/api/health` is public.

Socket.IO uses the `/files` namespace with websocket transport only. JWT comes
from `handshake.auth.token` or the Bearer header; explicitly invalid auth must
not fall back to the header. `RoomsService` queries memberships and joins
`team:{teamId}` on connection, then the gateway emits `files.ready`.
Uploads/deletions send `file:uploaded` and `file:deleted` with
`{ teamId, fileId }` through `FilesEmitterService`. Membership changes require
reviewing rooms/reconnection; keep the client and server aligned
(`../app/src/lib/files-realtime.ts`).

## Environment, database, and execution

1. Install with `pnpm install --frozen-lockfile`.
2. Prepare `.env` using `.env.example`; do not overwrite local environments.
   PostgreSQL, Redis, JWT_SECRET (at least 32 characters), Google OAuth, and Azure
   storage/container configuration are required. Compose only provides
   PostgreSQL and Redis.
3. Run `pnpm docker:up` (uses `docker/compose.yml`, ports 5432/6379).
4. Generate the client and apply migrations to the configured local database:

   ```sh
   pnpm exec prisma generate --config prisma7.config.ts
   pnpm exec prisma migrate deploy --config prisma7.config.ts
   pnpm start:dev
   ```

The configuration file is named `prisma7.config.ts`. The `db:generate`, `db:dev`,
and `db:prod` scripts do not pass `--config`; if the CLI does not discover it,
use the explicit commands above. To create a migration, run
`pnpm exec prisma migrate dev --config prisma7.config.ts --name <name>` against
the development database. Version the schema and migration, regenerate the
client, and do not edit applied migrations or
`src/infrastructure/database/prisma/client/`. Models use UUIDv7, camelCase fields
mapped to snake_case tables/columns, and uniqueness/relationship constraints in
the schema.

`PORT` defaults to 8430 in the schema and 3333 in the example. `PUBLIC_BASE_URL`
defines public links; `CORS_ORIGINS` accepts comma-separated origins. Align the
OAuth callback, public URL, and the app's `VITE_API_URL`.

## Validation and known limitations

- Build: `pnpm build`; shared quality checks: `pnpm check` at the root.
  CI generates the Prisma client before compilation and does not run E2E tests.
- E2E: `pnpm docker-test:up`, database on 5433 and Redis on 6380. Prepare
  `.env.test` with `NODE_ENV=test`, dedicated test URLs, and the other variables
  required by AppModule. Azure initialization also requires valid configuration.
- Explicitly apply migrations to the test database and run `pnpm test:e2e`.
  Confirm the active `DATABASE_URL`: `cleanupDatabase` executes
  `TRUNCATE ... CASCADE`. Never point the suite at development data that must be
  preserved or at production.
- The `db:test` and `test:e2e` scripts use `dotenv run`, but `package.json`
  declares only the `dotenv` library, without an explicit CLI package. If the
  executable is missing, load `.env.test` in a controlled way before running the
  Prisma CLI and `pnpm exec vitest run --config vitest.config.e2e.ts`.
- Vitest uses SWC for decorators, globals, and `fileParallelism: false`.
  `test/e2e/setup.ts` exports `setup` but is listed under `setupFiles`, without
  explicitly calling the function; do not rely on it to apply migrations.
- Extend existing tests for the rules being changed: authorization, expiration,
  concurrency, rotation, and events are relevant contracts. Report existing
  failures separately from checks that depend on services/credentials.
