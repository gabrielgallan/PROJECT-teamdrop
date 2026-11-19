# Team Drop API

## Authentication MVP

The API uses Google OAuth for identity, 15-minute access JWTs and rotating opaque refresh tokens. Each desktop login creates one PostgreSQL `Session` (table `sessions`) with an absolute 30-day expiration. Only the SHA-256 refresh hash is stored. Redis holds temporary OAuth states and desktop tickets; it does not store persistent sessions.

### Setup

Install dependencies with `pnpm install`. Copy `.env.example` to `.env`, configure PostgreSQL, Redis and Google OAuth, and generate a signing secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set that value as `JWT_SECRET` (at least 32 characters). Issuer, audience (`teamdrop-api`), algorithm (`HS256`) and lifetimes are constants in the auth module. Keep the signing secret stable across API restarts and instances; replacing it invalidates existing access JWTs.

Use a Google OAuth **Web application** client, since the API performs the code exchange and keeps the client secret. Register the exact callback URL configured by `GOOGLE_OAUTH_CLIENT_REDIRECT_URI`; locally, `http://localhost:8430/api/auth/google/callback`. In production, expose the API over HTTPS. Never embed the Google client secret or JWT signing secret in the desktop app.

Apply migrations explicitly to the intended database, then generate the Prisma Client and build:

```sh
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm exec prisma generate --config prisma7.config.ts
pnpm build
```

### Desktop login

1. Generate a random PKCE verifier in the desktop and compute `BASE64URL(SHA256(verifier))`.
2. `POST /api/auth/desktop/start` with `{ "codeChallenge": "..." }` returns `ticket`, `authorizationUrl`, `expiresIn: 300` and polling `interval: 2` seconds.
3. Open `authorizationUrl` in the system browser. The backend uses a separate PKCE verifier for Google. The callback creates or identifies the Google account and completes the ticket; it does not return tokens to the browser.
4. Poll `POST /api/auth/desktop/exchange` with `{ "ticket": "...", "codeVerifier": "..." }`. While waiting, the response is `{ "status": "pending" }`. On success it contains:

```json
{
  "status": "complete",
  "accessToken": "<JWT>",
  "refreshToken": "<opaque secret>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresAt": "<ISO 8601 date>",
  "user": { "id": "<UUID>", "email": "user@example.com", "name": null, "avatarUrl": null }
}
```

The ticket can only be exchanged once and requires the original desktop verifier. OAuth states last five minutes; completed or denied tickets last up to one minute. Google accounts are identified by their provider subject, not automatically linked by matching email.

### Access, renewal and logout

| Endpoint | Authentication | Response |
| --- | --- | --- |
| `GET /api/auth/me` | `Authorization: Bearer <accessToken>` | `200 { user }` |
| `POST /api/auth/refresh` | JSON `{ "refreshToken": "..." }` | `200` with a new token pair |
| `POST /api/auth/logout` | JSON `{ "refreshToken": "..." }` | `204`, including when already invalid |

Refresh responses contain `accessToken`, `refreshToken`, `tokenType`, `expiresIn` and `refreshExpiresAt`. They replace the refresh token without extending the original 30-day deadline. Access JWTs never outlive that deadline, so `expiresIn` may be less than 900 near session expiry.

The desktop should store the refresh token in the OS credential vault and keep the access JWT in memory. On startup, renew using the saved refresh token. Serialize refresh requests and replace the stored refresh after each successful renewal. Do not blindly retry a refresh after a network timeout: if the response was lost after rotation, the old credential is already invalid and a new Google login may be necessary. Desktop storage and renewal integration are a separate change.

Malformed inputs return `400`. Authentication failures return `401` with a top-level `code`:

| Code | Meaning |
| --- | --- |
| `INVALID_ACCESS_TOKEN` | Missing token, invalid signature, algorithm or claims |
| `ACCESS_TOKEN_EXPIRED` | Valid access token whose lifetime ended; renew then retry the original request once |
| `INVALID_REFRESH_TOKEN` | Refresh is unknown, expired, revoked or already rotated; sign in again |

Routes are protected by the global access-token guard unless marked `@Public()`. Controllers can use `@CurrentUser()` for `{ userId, sessionId }`; it performs no database lookup. Team authorization must still be checked by the resource handling the request. Full request/response contracts are available at `/reference`.

Logout removes only the session matching the current refresh hash. Issued JWTs remain usable until expiration (at most 15 minutes). There is no refresh history, reuse detection or scheduled cleanup of expired sessions in this MVP. Previous opaque Redis access tokens are no longer accepted; existing clients must sign in again and adopt the new refresh/logout contract. Responses containing credentials use `Cache-Control: no-store`; never log their bodies or authorization headers.

### Verification

```sh
pnpm exec prisma generate --config prisma7.config.ts
pnpm test:auth
```

The auth suite uses Node's test runner and starts its own temporary PostgreSQL cluster, applies all migrations and checks schema drift. It requires PostgreSQL `initdb` and `postgres` on `PATH`, or `PG_BIN` pointing to the binaries directory. It does not use or migrate the configured `DATABASE_URL`. The temporary server binds to loopback on an available port and is removed after the suite.

HTTP tests exercise real Nest controllers, guards, JWTs and Prisma persistence, including concurrent refreshes. Google and the temporary ticket cache use test doubles; these tests do not verify live Google OAuth or a real Redis instance.

### Authentication

- [ ] **RF001** — The system must support authentication through OAuth providers (Google and Microsoft).
- [x] **RF002** — The system must automatically create a user account upon first login.
- [x] **RF003** — The system must allow session renewal without requiring reauthentication.
- [x] **RF004** — The system must allow users to log out.

### Teams

- [ ] **RF005** — The system must allow users to create teams.
- [ ] **RF006** — The system must allow users to join multiple teams.
- [ ] **RF007** — The system must list all teams a user belongs to.
- [ ] **RF008** — The system must allow team owners to update their team information.
- [ ] **RF009** — The system must allow team owners to delete their teams.

### Members

- [ ] **RF010** — The system must allow users to view team members.
- [ ] **RF011** — The system must allow team owners to remove members from their teams.
- [ ] **RF012** — The system must allow members to voluntarily leave a team.

### Invites

- [ ] **RF013** — The system must allow team owners to generate invitations for their teams.
- [ ] **RF014** — The system must allow team owners to configure invitation expiration dates and usage limits.
- [ ] **RF015** — The system must allow users to join teams through valid invitations.
- [ ] **RF016** — The system must allow team owners to revoke invitations.
- [ ] **RF017** — The system must allow team owners to view their team invitations.

### Files

- [ ] **RF018** — The system must allow users to upload files to teams.
- [ ] **RF019** — The system must allow users to quickly capture and share screenshots.
- [ ] **RF020** — The system must list files shared within each team.
- [ ] **RF021** — The system must provide a unified list of recent files from all teams a user belongs to.
- [ ] **RF022** — The system must allow users to view file details
