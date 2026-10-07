@echo off
REM Open a psql shell in the running paystay-db container. Type \q to leave.
docker exec -it paystay-db psql -U paystay -d paystay %*
