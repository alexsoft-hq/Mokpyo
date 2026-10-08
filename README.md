# Mokpyo

**Self-hosted, open-source goal and OKR management for teams.**

[한국어](README.ko.md) · [MIT License](LICENSE) · [ALEXSOFT](https://alexsoft.co.kr/en/) · [Architecture & development enquiries](https://alexsoft.co.kr/diagnosis/#inquiry)

Mokpyo (Korean for “goal”) brings goals, key results and project activity into card, table, board, timeline and dashboard views. Run it on your own infrastructure and adapt it to your organization. The published software has no per-seat fee or paid subscription; infrastructure and optional external services are paid by the operator. The interface supports English and Korean, with a language selector on the sign-in screen and in the app. Your choice is saved in your browser; user-authored content stays in its original language.

![Mokpyo goal management demo](assets/readme/dashboard.png)

*A local demo workspace with fictional data. Sample goals describe illustrative work, not claims about shipped features.*

## Features

- Five views over the same goals, with project hierarchies and assignee summaries.
- Nested goals, numeric key results, aggregated progress, cycles and automatic progress-change check-in snapshots.
- Comments, @mentions, in-app notifications, attachments, email invitations and activity history.
- Custom status labels and fields, saved views and rule-based automations.
- Automation triggers for creation, status, assignee, progress and deadlines, with actions such as notifications, field updates, comments and webhooks.
- Organization membership and OWNER / ADMIN / MEMBER roles.
- Optional Azure OpenAI reports, Google login, SMTP and Amazon S3 storage.

AI reports require your own Azure OpenAI configuration and send relevant goal data to that provider. Core goal management works without external integrations.

## Screenshots

The same goals can be explored in several views. Click an image to inspect it at full size.

| Cards | Table |
| --- | --- |
| [![Goal cards with progress and owners](assets/readme/cards.png)](assets/readme/cards.png) | [![Editable goal table grouped by status](assets/readme/table.png)](assets/readme/table.png) |

| Board | Timeline |
| --- | --- |
| [![Kanban board with configurable statuses](assets/readme/board.png)](assets/readme/board.png) | [![Goal schedules in the timeline](assets/readme/timeline.png)](assets/readme/timeline.png) |

<details>
<summary>Goal details, key results, and collaboration</summary>

![Goal details with custom fields and key results](assets/readme/goal-detail.png)

</details>

## Quick start with Docker

Install Docker and Docker Compose, then:

```bash
git clone https://github.com/alexsoft-hq/Mokpyo.git
cd Mokpyo
cp .env.example .env
```

Edit `.env` before starting:

1. Replace `POSTGRES_PASSWORD` with a new random value. Hexadecimal avoids URL-encoding issues.
2. Set `JWT_SECRET` and `SESSION_SECRET` to separate values generated with `openssl rand -hex 32`.
3. For local HTTP evaluation, set `APP_URL=http://localhost:3001` and `COOKIE_SECURE=false`. For external operation, use your actual HTTPS URL and secure cookies.

```bash
docker compose --profile full up -d --build
```

Open <http://localhost:3001>. Compose sets the container's database URL and the app applies PostgreSQL migrations at startup. Database and uploaded files use separate persistent volumes. `docker compose down -v` deletes those volumes.

Without SMTP, email verification codes appear in `docker compose logs app` for local evaluation. Configure SMTP and restrict log access before accepting real users.

## Development

Use Node.js 24 and Docker. Copy `.env.example` and configure passwords and secrets. Match the password in `DATABASE_URL` to `POSTGRES_PASSWORD`, keep `?schema=dashboard`, and set `APP_URL=http://localhost:8080`.

```bash
npm ci
npm run dev:setup      # start PostgreSQL, generate Prisma client, apply migrations
npm run dev:all        # frontend :8080, API :3001
```

Optional demo seed, for a local evaluation database only:

```bash
DEMO_USER_PASSWORD='choose-a-new-demo-password' npm run db:seed:demo:en
```

The English seed creates a separate workspace with six projects, 79 goals, and fictional collaborators. Sign in as `mokpyo.demo.en.owner@example.invalid` using the password you supplied. It permits only loopback PostgreSQL connections and refuses to overwrite an existing demo workspace or user. Set `DEMO_OWNER_EMAIL` to add an existing local account as an additional owner without changing its profile. See [the seed script](prisma/seed-demo-en.ts).

## Installation and operation

See [.env.example](.env.example) for configuration and the [Prisma guide](prisma/README.md) for database changes.

- **Base setup:** Node.js 24, PostgreSQL and local attachment storage. The Docker image runs as the unprivileged `node` user.
- **Optional services:** Configure SMTP, Google OAuth, Azure OpenAI and Amazon S3 separately. Provider fees may apply.
- **Operator responsibilities:** Manage HTTPS, accounts and access, updates, monitoring, and backup and recovery for both the database and attachments.
- **Access boundaries:** Organization membership controls access. Private permissions for individual projects within an organization are not implemented.
- **Automation limits:** Automations run inside the application process, without a durable job queue or guaranteed retries.
- **Security and privacy:** See [SECURITY.md](SECURITY.md) for known behavior and vulnerability reporting. Operators must also provide privacy information appropriate to their deployment.

To create a deployment archive without Docker:

```bash
./prepare-release.sh
```

The resulting `mokpyo-production.tar.gz` contains builds, schema, migrations, dependency manifests and lockfile, and an environment example. It excludes actual `.env` files, database data and uploads. **Installing dependencies on the target server requires internet access.** Follow the README inside the archive for configuration, installation, migrations and startup. Air-gapped deployment needs separate preparation for the target environment.

## Architecture

```text
src/             React 18 · TypeScript · Vite · Tailwind · shadcn/ui
  pages/         Goal views, settings, authentication and product pages
  components/    UI and interaction components
  lib/           API client and domain calculations
server/          Express 5 · Prisma
  app.ts         App composition and shared endpoints
  routes/        Domain routers for auth, organizations, comments, cycles and automations
  middleware/    Authentication, organization context and audit logging
  services/      Automation engine and scheduler
  utils/         File storage and AI integration
prisma/          PostgreSQL schema, migrations and demo seed
docker/          Container entrypoint and database initialization
```

Mokpyo is a public example of ALEXSOFT's product engineering, from design through implementation and verification. The code covers organization-aware data access, synchronized views, rule-based automation, storage adapters and tests.

```bash
npm run ci            # typecheck, lint, tests, frontend and server builds
npm run test:watch
npm run build:root    # frontend served at /
npm run build         # frontend served at /dashboard/
npm run build:server
```

The suite includes unit and API tests that mock Prisma. Passing CI does not establish real database recovery, compatibility with every deployment environment or performance under load.

### Localization

The UI uses i18next and react-i18next. English catalogs live in [src/i18n/locales](src/i18n/locales); Korean source phrases serve as keys and Korean fallback messages. Keep variable values in interpolation parameters, translate complete messages, and preserve user-authored data. Locale switching updates labels and date formatting without remounting the app.

## Use, contribute, or work with ALEXSOFT

Report bugs and proposals through [GitHub Issues](https://github.com/alexsoft-hq/Mokpyo/issues). Read [CONTRIBUTING.md](CONTRIBUTING.md) and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Community support is best effort with no guaranteed response or resolution time.

For architecture reviews, internal tools, deployment assistance, migrations, integrations or custom software development, [contact ALEXSOFT](https://alexsoft.co.kr/diagnosis/#inquiry) or email [contact@alexsoft.co.kr](mailto:contact@alexsoft.co.kr). Paid work has separately agreed scope, schedule, fees and support terms.

Mokpyo is available under the [MIT License](LICENSE), including commercial use, modification and redistribution with the required notices retained. Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
