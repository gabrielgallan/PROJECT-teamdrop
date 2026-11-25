# Teamdrop desktop

Tauri 2, React and TypeScript widget. Authentication persists in the Windows Credential Manager; Google OAuth and token issuance are handled by the existing Teamdrop API.

## Development

Install the Windows Tauri prerequisites (Rust, Microsoft C++ build tools and WebView2), then:

```sh
pnpm install
pnpm tauri dev
```

Copy `.env.example` to `.env` and configure `VITE_API_URL` (default: `http://localhost:8430`). The API must already have its Session migration applied, a JWT signing secret, Redis and Google OAuth configured. The app never receives the Google client secret or JWT signing key.

Only an API origin is accepted, without a path, credentials, query or fragment. Production requires HTTPS. Debug builds also accept HTTP on localhost, 127.0.0.1 or IPv6 loopback. The native HTTP client does not follow redirects. The origin is fixed for the process lifetime and scopes the vault entry, so local and production accounts do not overwrite one another.

`pnpm dev` alone is a browser preview. It explicitly shows that persistent login requires Tauri; it does not save credentials in browser storage. To build the installer, configure the production HTTPS API URL and run `pnpm tauri build`.

## Session behavior

- React starts in “Restaurando sessão”. Initialization is shared across StrictMode mounts.
- On first login, TypeScript creates PKCE, starts OAuth and opens the system browser. Polling invokes Rust, which receives the backend token pair directly.
- Rust stores only the refresh token, its absolute expiration and any uncertain-renewal marker in a single Windows credential. Persistence is explicitly Local (same Windows user and machine, surviving app and OS restarts).
- A successful login is only reported after saving the refresh. The frontend receives the user, never the refresh token.
- Access JWTs and the user profile remain in Rust memory. The API helper obtains a JWT over IPC and sends it in the Authorization header; it never persists it.
- Access renews on demand, normally 30 seconds before expiry. Near the absolute session deadline, short tokens are reused until expiration. There is no background timer that signs the user out after 15 minutes.
- Concurrent callers share serialized native renewal and recheck the cached token after waiting. An explicitly expired HTTP request is retried at most once.
- Closing/hiding the widget keeps the process alive in the tray. “Sair” exits without deleting credentials. “Encerrar sessão” revokes the current refresh and removes the local credential.
- If logout cannot reach the server, the app keeps the session and offers retry. If remote revocation succeeds but vault deletion fails, access is blocked and retry performs the pending local deletion.
- The backend's 30-day session deadline is never extended. Expired or invalid refresh credentials are removed and require a new login. Existing JWTs may remain valid on the server for up to 15 minutes after logout.

## Ownership and contracts

The `auth/` module owns session state, login and recovery. Its React hooks live in `hooks/`, HTTP login start in `api/auth/`, and Tauri auth commands in `desktop/`. `useSession` connects session state to public routes; authenticated features use `useAuth`. The Ky transport obtains access tokens through IPC and preserves request bodies for one replay, only on `401 ACCESS_TOKEN_EXPIRED`. Other 401 responses require explicit recovery; resource 403s, network failures and 5xxs do not erase credentials.

Frontend responsibilities:

| Directory    | Responsibility                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `lib/`       | Ky client, HTTP errors and React Query client configuration                                                                   |
| `api/`       | Typed HTTP operations grouped by resource, query keys, shared query options and mutations that maintain account-scoped caches |
| `api/auth/`  | Public HTTP login start; exchange, profile restoration and refresh stay native                                                |
| `desktop/`   | All Tauri integrations: auth, file picker, filesystem/download, app commands and invitation links                             |
| `auth/`      | Session store, authentication workflow, domain errors and session types                                                       |
| `hooks/`     | Auth access, workspace access, upload queue, file selection/actions, navigation and timers                                    |
| `app/`       | Components, screens, layouts, router, workspace provider/context and presentation helpers                                     |
| `global.css` | Global styles at the root of `src/`                                                                                           |

Authenticated calls use `api` from `lib/ky.ts`. Public endpoints explicitly set `context: { public: true }`. Response types reflect the HTTP envelope; presentation helpers format members, sizes and dates separately. Calls returning 204 do not parse JSON. The old `services/` directory is removed.

Simple, screen-specific queries are declared directly in components. Shared team queries and file pagination/QR policies stay in their resource's `api/*/queries.ts`. Mutations with cache coordination stay in `api/*/mutations.ts`; simple actions use `useAccountMutation` directly. Hooks that combine HTTP with clipboard or native download live in `hooks/`, with OS operations delegated to `desktop/`.

React Query owns remote data. Keys include the account and team; file cursors use `pageParam`. Reads are fresh for 30 seconds and retry transient failures at most twice. Mutations do not retry automatically. Logout/account changes cancel queries and clear caches; late private responses and mutation cache updates from previous sessions are discarded.

Internal routes are `/`, `/settings`, `/settings/teams/:teamId`, `/invites/accept`, `/invites/:token/accept` and `/teams/:teamId/files/:fileId/qr`, guarded by the restored session. `/login` is public. Browser URLs are not used as the desktop navigation store.

The Rust auth module separates commands, session coordination, HTTP access, vault access and types. All vault operations run on blocking worker threads. Backend token types are not IPC-serializable, and native errors contain safe, fixed messages rather than HTTP bodies or secrets.

Commands:

| Command                 | Input                              | Output                              |
| ----------------------- | ---------------------------------- | ----------------------------------- |
| `auth_restore_session`  | `apiBaseUrl`                       | `{ user }` or null                  |
| `auth_exchange_login`   | `ticket, codeVerifier, generation` | pending or complete with `{ user }` |
| `auth_get_access_token` | optional `rejectedToken`           | access JWT                          |
| `auth_cancel_login`     | none                               | next login generation               |
| `auth_logout`           | none                               | success or structured error         |

Cancel invalidates a generation before waiting for any in-flight exchange. Late credentials are revoked on a best-effort basis and discarded. Revocation may fail offline; those server sessions then expire naturally. The backend's exchange ticket is single-use, so an exchange with a lost response is not automatically repeated.

Native errors use `{ code, message }`. Important codes are `INVALID_REFRESH_TOKEN`, `CREDENTIAL_STORE_ERROR`, `NETWORK_ERROR`, `REFRESH_UNCERTAIN` and `LOGIN_CANCELLED`.

## Recovery limitations

A rotating refresh has no replay/idempotency recovery in the current backend. If the server rotates it but its response is lost, the app cannot recover the replacement. It preserves an uncertainty marker in the vault and requires an explicit new login, instead of retrying rotation automatically, including after restart.

If a replacement is received but saving it fails, Rust retains it in memory and retries saving before doing another renewal. Closing the process before that save succeeds can require a new login. A crash in the rotation/persistence window has the same limitation.

No refresh token is stored in localStorage, sessionStorage, a plain JSON file or Vite environment variables. No generic IPC command reads or writes arbitrary vault entries. Windows is the supported persistent-auth platform for this delivery; other platforms report an unsupported-platform error.

## Verification

```sh
pnpm test
pnpm build
cd src-tauri
cargo check
cargo test
cargo fmt --check
```

The Node test runner uses the installed TypeScript compiler and JSDOM, without an additional test framework. Tests cover HTTP contracts, expiry replay with JSON/multipart bodies, cancellation, timeout, cache isolation, pagination, partial uploads, auth guards, invitation navigation and QR expiration. Rust tests use an in-memory vault and a real local HTTP fixture to cover restoration, concurrent renewal, replacement-save failure, lost responses, cancellation and logout.

To run the opt-in Windows vault check:

```sh
cargo test windows_vault_roundtrip -- --ignored --nocapture
```

This test creates a uniquely named synthetic credential, verifies persistence is Local, reads it through another store instance and deletes it. It never reads or overwrites an actual Teamdrop login.

Manual acceptance with the configured API:

1. Start the Tauri app and log in with Google in the system browser.
2. Hide and reopen the widget; the authenticated screen should remain.
3. Exit the process and launch it again; session restoration should not open Google.
4. Use an expired access token and verify one refresh restores access.
5. Disconnect the API and attempt logout; an error should preserve the local session.
6. Reconnect, log out and restart; the login screen should appear.

## Teams and invitation links

Settings now uses the API for listing, creating, renaming and leaving teams, member management, invitation creation and revocation. File listing, pagination, multipart uploads, download and QR sharing are integrated separately through their API/query/mutation modules. Team mutations wait for server confirmation. Renaming keeps the server's updated slug for subsequent requests. State is scoped to the signed-in account and discarded on logout.

A newly generated invitation URL is available only while its management screen is open. Copy it before leaving; it is not persisted or recoverable. Creating a new invitation invalidates previous links. Revoking invitations does not require the previous URL.

The public link opens a minimal page served by the API. Its button launches `teamdrop://invite?token=...`. The widget shows the team after authentication, then submits an authenticated POST only after explicit confirmation. A pending invitation survives the existing login flow in memory, but not process exit. Settings → **Entrar com convite** also accepts the public link by manual paste. Public links are parsed locally; only the configured API receives authentication headers.

Deep linking uses Tauri's deep-link and single-instance plugins. During Windows debug startup, the app attempts to register the scheme for development. Installed builds register it through the installer. Restart `pnpm tauri dev` after installing dependencies or changing Rust/configuration. Run the app and development terminal/IDE without administrator privileges: Windows can block forwarding a browser link to an elevated instance. Registration failure leaves manual paste available. No second widget should be opened for an incoming link.

### Manual acceptance check

1. Configure `VITE_API_URL` for the running API; set the API's `PUBLIC_BASE_URL` to a reachable origin (or leave it unset for a local URL using `PORT`). Both instances/devices must use the same backend.
2. As an owner, create a team, open management, generate and copy an invitation. Leave and reopen management: the previous URL must not be restored, while revocation remains available.
3. With another account, open the link and choose **Abrir no Teamdrop**. Check both running and closed app cases. If not signed in, complete Google login; the invitation must reappear for confirmation.
4. Confirm and check that the team appears under settings. Repeat the link: membership must not be duplicated or consume another use.
5. Test manual paste, cancellation, revocation, expired/exhausted links, renaming followed by another action, removing a member, and leaving as a member. An owner cannot leave or remove themselves.

`pnpm test` runs the frontend suite, including invitation parsing, receipt before login and explicit confirmation through the current API routes. `pnpm build` checks TypeScript and builds the frontend. In `src-tauri`, run `cargo check` and `cargo test` for native verification. Real Windows browser-to-widget activation and live Google sign-in still require manual testing.

## Files

The selected team's files use `GET /api/teams/:teamId/files?limit=10&cursor=...`. **Carregar mais** appends pages until `nextCursor` is null. Changing teams aborts the previous listing and discards late responses. Failed pages preserve the loaded rows and retry the same cursor.

Uploads send one multipart `file` per request. Files chosen in the native picker are read through the filesystem plugin, scoped to the selected paths. Successful uploads leave the queue; a partial failure keeps only unconfirmed/unattempted files. A lost response is not retried automatically because the API has no upload idempotency contract. The list refreshes after the batch, including uncertain failures. The queue survives route navigation, clears on team changes and prevents team switching while uploading. The status counts files, not bytes.

Each row downloads on click. Its link button calls `GET /api/files/:fileId/url` anew and copies the five-minute URL. In Tauri, downloading opens a save dialog and streams the public download endpoint's redirect to a temporary file before replacing the chosen destination. Native authentication requests still reject redirects; the separate public download client follows up to five redirects and sends no Bearer token. Inline preview, screenshots, deletion and WebSocket updates are outside this integration.

Frontend contract and component tests use controlled fetch responses and do not require a running API. They do not establish live backend, storage or OS integration. Native download/session fixtures run with `cargo test` from `app/src-tauri/`; the real-vault test remains opt-in.

### File QR codes

Each file has a QR action beside its copy-link button. It calls the same public URL endpoint, renders the installed `@lglab/react-qr-code` SVG locally and keeps the signed URL only in screen memory. The five-minute countdown starts before the request; expired codes are removed and regenerated only on demand. Back/Escape restores the list, its scroll position and the triggering button focus. Cached pages remain available, with background revalidation if stale. Direct QR routes work without file metadata by displaying a generic file label. Tests cover direct QR routes, latency, expiry, explicit renewal and navigation focus. Mobile-camera scanning with real Azure links remains a manual validation step.
