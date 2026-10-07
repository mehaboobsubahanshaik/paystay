#!/bin/sh
# Write the live schema (tables, indexes, constraints) to database/schema.live.sql
set -e
cd "$(dirname "$0")/.."
docker exec paystay-db pg_dump -U paystay -d paystay --schema-only --no-owner > schema.live.sql
echo "Wrote database/schema.live.sql"
