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
| `GET /api/auth/profile` | `Authorization: Bearer <accessToken>` | `200 { user }` |
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

## Teams API

All routes require a Bearer access token. Team member listing and invitation management are restricted to the team owner.

| Endpoint | Input | Response |
| --- | --- | --- |
| `GET /api/teams` | — | `200` with the user's teams and `role` |
| `POST /api/teams` | `{ "name": "Product" }` | `201` with the created team |
| `PATCH /api/teams/:slug` | `{ "newName": "Design" }` | `200` with the updated team, including its new `slug` |
| `GET /api/teams/:slug/members` | — | `200` with public member profiles and `role` |
| `POST /api/teams/:slug/invites` | Optional `{ "maxUses": 100, "expiresIn": 604800 }` | `201 { token, expiresAt, maxUses, uses }` |
| `GET /api/teams/:slug/invites/active` | — | `200 { invite: { id, expiresAt, maxUses, uses } }`, or `{ "invite": null }` |
| `DELETE /api/teams/:slug/invites/active` | — | `204`; repeated revocation also succeeds |
| `POST /api/teams/invites/accept` | `{ "token": "..." }` | `200` with the joined team and `role` |

Names are trimmed and cannot be blank. After renaming, clients must use the returned slug for subsequent requests. The default invitation lasts seven days and allows 100 new memberships. Existing members do not consume another use. Invalid, expired, revoked or exhausted invitations cannot create memberships (`410`); malformed tokens return `400` and unauthorized management returns `403`.

Creating an invitation revokes the previous one in the same transaction. A team row lock serializes creation, revocation and acceptance. The active endpoint returns only metadata, and no invitation after expiration or exhaustion. Responses containing invitation tokens use `Cache-Control: no-store`.

Invitation tokens are returned only when created; clients must copy or save the link at that point. Only the SHA-256 hash is stored, so the original token cannot be recovered. Generate a new invitation to obtain another link, invalidating the previous one. `CryptographyModule` provides token generation and hashing; auth uses Base64URL hashes and invitations use hexadecimal hashes.

Run `pnpm test:teams` to verify real Nest HTTP routes, authentication, owner authorization, member roles, name validation, renaming and invitation lifecycle/concurrency against a temporary PostgreSQL database. It requires PostgreSQL binaries on `PATH` (or `PG_BIN`) and Postman CLI, and does not use the configured `DATABASE_URL`.

## Functional requirements

Checked requirements are integrated; mock interactions are not considered complete.

### Authentication and profile

- [x] **RF001** — The system must allow users to sign in with Google.
- [x] **RF002** — The system must allow automatic account creation upon first login.
- [x] **RF003** — The system must allow users to restore and renew their sessions.
- [x] **RF004** — The system must allow users to log out.
- [x] **RF023** — The system must allow users to view their profile.

### Teams

- [ ] **RF005** — The system must allow users to create a team.
- [ ] **RF006** — The system must allow users to belong to multiple teams.
- [ ] **RF007** — The system must allow users to list their teams.
- [ ] **RF008** — The system must allow team owners to update their teams.

### Members

- [ ] **RF010** — The system must allow team owners to list team members.
- [ ] **RF011** — The system must allow team owners to remove members.
- [ ] **RF012** — The system must allow members to leave a team.
- [ ] **RF024** — The system must allow automatic revocation of team access when a membership ends.

### Invites

- [ ] **RF013** — The system must allow team owners to create invitation links.
- [ ] **RF014** — The system must allow invitations to expire.
- [ ] **RF015** — The system must allow users to join teams through valid invitations.
- [ ] **RF016** — The system must allow team owners to revoke or replace invitation links.
- [ ] **RF017** — The system must allow team owners to view invitation status and copy newly generated invitation links.

### Files

- [ ] **RF018** — The system must allow members to share files with their teams.
- [ ] **RF019** — The system must allow users to capture and share screenshots.
- [ ] **RF020** — The system must allow members to access files shared with their teams.
- [ ] **RF021** — The system must allow users to view recent files from all their teams.
- [ ] **RF022** — The system must allow users to view file details, preview files, download them and copy their links.
- [ ] **RF025** — The system must allow shared files to expire.

### Desktop behavior

- [ ] **RF026** — The system must allow users to access the app from the Windows tray.
- [ ] **RF027** — The system must allow users to confirm or cancel destructive actions.
