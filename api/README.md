# TeamDrop API

Backend built with NestJS, Prisma, PostgreSQL, and Redis. Handles Google authentication, teams, invitations, and file sharing through Azure Blob Storage, with Socket.IO events for live updates.

## How to run locally

```bash
# 1. Enter the api directory
cd api

# 2. Install dependencies
pnpm install

```

```bash
# 3. Start the Docker services (postgresql and redis)
docker compose up -d

# 4. Create and configure .env based on .env.example

# 5. Apply the migrations and generate the Prisma client
pnpm db:prod
pnpm db:generate
```

### Development

```bash
pnpm start:dev
```

### Production

```bash
pnpm build
pnpm start:prod
```

## Documentation

The API is documented with OpenAPI and can be explored in the Swagger UI at /reference.

### Functional Requirements (FR)

- **FR-001** — The system must allow users to sign in with Google account.
- **FR-002** — The system must allow users to restore and renew their sessions.
- **FR-003** — The system must allow users to log out.
- **FR-004** — The system must allow users to view their profile.
- **FR-005** — The system must allow users to create a team.
- **FR-006** — The system must allow users to list their teams.
- **FR-007** — The system must allow users to belong to multiple teams.
- **FR-008** — The system must allow users to list their team members.
- **FR-009** — The system must allow users to leave from teams.
- **FR-010** — The system must allow team owners to update their teams.
- **FR-011** — The system must allow team owners to remove a team member.
- **FR-012** — The system must allow team owners to create invitation links.
- **FR-013** — The system must allow invitations to expire.
- **FR-014** — The system must allow users to join teams through valid invitations.
- **FR-015** — The system must allow team owners to revoke invitation links.
- **FR-016** — The system must allow members to share files with their teams.
- **FR-017** — The system must allow users to view and access recent files from all their teams.
- **FR-018** — The system must allow users to view file details, download files, and share files through links or QR codes for preview or download.
- **FR-019** — The system must allow users to delete a uploaded file
