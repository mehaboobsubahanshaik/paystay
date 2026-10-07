#!/bin/sh
# Restore a backup made by backup.sh:  ./restore.sh paystay-20261007-2350.dump
# Replaces the current data. Stop the API first (docker compose stop api) so nothing writes meanwhile.
set -e
[ -f "$1" ] || { echo "Usage: $0 <backup.dump>"; exit 1; }
docker exec -i paystay-db pg_restore -U paystay -d paystay --clean --if-exists --no-owner < "$1"
echo "Restored $1"
