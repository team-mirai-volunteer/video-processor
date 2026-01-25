#!/bin/bash
set -euo pipefail

# Build DATABASE_URL from individual environment variables if not set
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${DATABASE_HOST:-}" ] && [ -n "${DATABASE_NAME:-}" ] && [ -n "${DATABASE_USER:-}" ] && [ -n "${DATABASE_PASSWORD:-}" ]; then
    # URL encode the password
    ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent(process.env.DATABASE_PASSWORD))")
    export DATABASE_URL="postgresql://${DATABASE_USER}:${ENCODED_PASSWORD}@localhost/${DATABASE_NAME}?host=${DATABASE_HOST}"
  else
    echo "Error: DATABASE_URL or DATABASE_HOST/NAME/USER/PASSWORD must be set"
    exit 1
  fi
fi

# Run prisma db push
exec pnpm db:push
