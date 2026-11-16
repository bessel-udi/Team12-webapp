#!/usr/bin/env bash
# Starts the QuickFundi API from a fresh clone.
# Needs: Node.js 20+, and a server/.env file (copy server/.env.example and fill it in).
set -e
cd "$(dirname "$0")/server"

if [ ! -f .env ]; then
  echo "Missing server/.env. Run: cp .env.example .env   then fill in the values (DB_*, API_KEYS, PARTNER_*)."
  exit 1
fi

npm install
echo "Starting API on http://localhost:${PORT:-5000}"
npm start