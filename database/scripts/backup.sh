#!/bin/sh
# Save a full backup of the PayStay database to a file in the current folder.
set -e
out="paystay-$(date +%Y%m%d-%H%M).dump"
docker exec paystay-db pg_dump -U paystay -d paystay -F c > "$out"
echo "Saved $out"
