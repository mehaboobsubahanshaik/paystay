# PostgreSQL 16 for PayStay. Scripts in init/ run once, when the data volume is first created.
FROM postgres:16-alpine
COPY init/ /docker-entrypoint-initdb.d/
