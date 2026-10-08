# Mokpyo

**Self-hosted, open-source goal and OKR management for teams.**

[한국어](README.md) · [MIT License](LICENSE) · [ALEXSOFT](https://alexsoft.co.kr/en/) · [Architecture & development enquiries](https://alexsoft.co.kr/diagnosis/#inquiry)

Mokpyo (Korean for “goal”) brings goals, key results and project activity into card, table, board, timeline and dashboard views. Run it on your own infrastructure and adapt it to your organization. The published software has no per-seat fee or paid subscription; infrastructure and optional external services are paid by the operator. The application interface is primarily Korean.

![Mokpyo goal management demo](assets/readme/dashboard.webp)

*Demo workspace with sample data.*

## Features

- Five views over the same goals, with project hierarchies and assignee summaries.
- Numeric key results, aggregated progress, cycles and automatic progress-change check-in snapshots.
- Comments, mentions, notifications, attachments, invitation links and activity history.
- Custom status labels and fields, saved views and rule-based automations with webhooks.
- Organization membership and OWNER / ADMIN / MEMBER roles.
- Optional Azure OpenAI reports, Google login, SMTP and Amazon S3 storage.

AI reports require your own Azure OpenAI configuration and send relevant goal data to that provider. Core goal management works without AI integration. Organization membership is the access boundary; private permissions for individual projects within an organization are not implemented. Automation runs inside the application process, without a durable queue or guaranteed retries.

## Quick start with Docker

Install Docker and Docker Compose, then:

```bash
git clone https://github.com/alexsoft-hq/mokpyo-oss.git
cd mokpyo-oss
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
npm run dev:setup
npm run dev:all        # frontend :8080, API :3001
npm run ci            # typecheck, lint, tests, frontend and server builds
```

Optional demo seed, for a local evaluation database only:

```bash
DEMO_USER_PASSWORD='choose-a-new-demo-password' npm run db:seed:demo
```

Account names are in `memberSpecs` in [prisma/seed-demo.ts](prisma/seed-demo.ts). The seed permits only localhost/127.0.0.1 databases. Do not run it against work data.

## Architecture and operation

React 18, TypeScript, Vite, Tailwind and shadcn/ui power the frontend. Express 5 and Prisma provide the backend, with PostgreSQL storage. `server/app.ts` assembles the app and common endpoints; `server/routes/` holds domain routers. `server/services/` contains automation execution, while `server/utils/` handles file storage and AI integration.

Operators manage HTTPS, access, updates, monitoring and recovery. Back up both PostgreSQL and uploaded files. Optional SMTP, Google OAuth, Azure OpenAI and S3 services require your configuration and may incur provider fees. See [.env.example](.env.example), [database notes](prisma/README.md) and [security notes](SECURITY.md). Tests mock Prisma and do not prove real database recovery or deployment performance.

For a build archive without Docker, run `./prepare-release.sh`. The resulting `mokpyo-production.tar.gz` contains builds, dependency manifests, schema, migrations and an environment example. It excludes actual environment files, databases and uploads. **Installing dependencies on the target requires internet access.** Follow the README inside the archive. Air-gapped deployment needs separate preparation for the target environment.

## Use, contribute, or work with ALEXSOFT

Report bugs and proposals through [GitHub Issues](https://github.com/alexsoft-hq/mokpyo-oss/issues). Read [CONTRIBUTING.md](CONTRIBUTING.md) and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Community support is best effort with no guaranteed response or resolution time.

Mokpyo is also a public example of ALEXSOFT's product engineering: organization-aware access, synchronized views, automation rules, storage adapters and test coverage. For architecture reviews, internal tools, deployment assistance, migrations, integrations or custom software development, [contact ALEXSOFT](https://alexsoft.co.kr/diagnosis/#inquiry) or email [contact@alexsoft.co.kr](mailto:contact@alexsoft.co.kr). Paid work has separately agreed scope, schedule, fees and support terms.

Mokpyo is available under the [MIT License](LICENSE), including commercial use, modification and redistribution with the required notices retained. Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
