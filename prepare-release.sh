#!/usr/bin/env bash
# Build a portable application archive. Install dependencies on the target host.
set -euo pipefail

cd "$(dirname "$0")"
PROD_DIR="mokpyo-production"
ARCHIVE="mokpyo-production.tar.gz"

# Refuse a symlink so generated output always stays inside this checkout.
if [ -L "$PROD_DIR" ] || [ -L "$ARCHIVE" ]; then
  echo "ERROR: Production output paths must not be symlinks." >&2
  exit 1
fi

for required in package.json package-lock.json prisma/schema.prisma .env.example LICENSE THIRD_PARTY_NOTICES.md; do
  if [ ! -f "$required" ]; then
    echo "ERROR: Required bundle input is missing: $required" >&2
    exit 1
  fi
done
if [ ! -d prisma/migrations ]; then
  echo "ERROR: PostgreSQL migration directory is missing." >&2
  exit 1
fi

echo "Building frontend for serving at / and production server..."
npm run build:root
npm run build:server

# This fixed directory contains only generated packaging output.
rm -rf -- "$PROD_DIR"
mkdir -p "$PROD_DIR/server" "$PROD_DIR/prisma"
cp -R dist "$PROD_DIR/"
cp server/production.cjs "$PROD_DIR/server/"
cp prisma/schema.prisma "$PROD_DIR/prisma/"
cp -R prisma/migrations "$PROD_DIR/prisma/"
cp package.json package-lock.json .env.example LICENSE THIRD_PARTY_NOTICES.md "$PROD_DIR/"

cat > "$PROD_DIR/setup.sh" <<'SETUP'
#!/usr/bin/env bash
# Run on the target host with network access, after configuring .env.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "ERROR: Copy .env.example to .env and configure it first." >&2
  exit 1
fi
npm ci --omit=dev
./node_modules/.bin/prisma generate
SETUP

cat > "$PROD_DIR/migrate.sh" <<'MIGRATE'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Prisma reads DATABASE_URL from .env or the process environment.
exec ./node_modules/.bin/prisma migrate deploy
MIGRATE

cat > "$PROD_DIR/start.sh" <<'START'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export NODE_ENV=production
exec node server/production.cjs
START
chmod +x "$PROD_DIR/setup.sh" "$PROD_DIR/migrate.sh" "$PROD_DIR/start.sh"

cat > "$PROD_DIR/README.md" <<'README'
# Mokpyo production build

This archive contains the built application, PostgreSQL schema and migrations,
root dependency manifests, environment example, and license notices.
**Target dependency setup requires network access.** Dependencies and Prisma
engines are installed and generated on the target machine; they are not included
in this archive. This is not a cross-platform offline installation package.

Requirements: Node.js 24, npm, Bash, and a reachable PostgreSQL database.
Your host must support the locked dependencies and Prisma engines (including
required system libraries such as OpenSSL).

1. Extract into an application directory:
   ```bash
   mkdir mokpyo-production
   tar -xzf mokpyo-production.tar.gz -C mokpyo-production
   cd mokpyo-production
   ```
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, authentication
   secrets, and any optional integrations. Keep `.env` private.
3. Install dependencies and generate Prisma on this host (requires network):
   ```bash
   ./setup.sh
   ```
4. Apply the PostgreSQL migrations, then start:
   ```bash
   ./migrate.sh
   ./start.sh
   ```

The frontend is built for the root path `/`. The default server port is 3001.
Configure a persistent uploads directory through `UPLOADS_DIR` and arrange your
own process supervision, database backups, and HTTPS reverse proxy.

No local environment files, database contents, or uploads are intentionally
copied into the archive. Build-time `VITE_*` values are public frontend values;
review your build environment before distributing this archive. For a new
release, use a clean checkout and `npm ci` before running the packaging script.

Mokpyo is licensed under MIT; see `LICENSE`. Dependency notices and their separate
licenses are described in `THIRD_PARTY_NOTICES.md` and installed packages.
README

COPYFILE_DISABLE=1 tar -czf "$ARCHIVE" -C "$PROD_DIR" .
echo "Created $ARCHIVE (target dependency setup requires network)."
echo "Extract, configure .env, then run ./setup.sh, ./migrate.sh, and ./start.sh."
