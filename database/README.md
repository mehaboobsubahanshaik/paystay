# PayStay database

PostgreSQL 16. The tables are created by the API on its first start (EF Core); this folder holds the
Docker image for the database, the one-time init script, a reference copy of the schema, useful queries
and backup scripts.

```
database/
├── Dockerfile            postgres:16-alpine + init scripts
├── init/
│   └── 01-extensions.sql runs once when the data volume is created (btree_gist for the overlap guard)
├── schema.sql            reference copy of the tables the API creates
├── queries.sql           ready-made queries: room board, bookings, requests, occupancy, referrals
├── pgadmin/servers.json  pre-registers the PayStay server in pgAdmin
└── scripts/
    ├── psql.sh / psql.bat open a SQL shell in the container
    ├── backup.sh          pg_dump to a file
    ├── restore.sh         restore a backup
    └── dump-schema.sh     export the live schema
```

## Connection details

| | |
|---|---|
| Host | `localhost` from your computer, `db` from the other containers |
| Port | `5433` on your computer (`DB_PORT` in `.env`), `5432` inside Docker |
| Database | `paystay` |
| Username | `paystay` |
| Password | `paystay` |
| Container | `paystay-db` |

## Three ways to look at the data

**1. SQL shell** (nothing to install):

```bash
docker exec -it paystay-db psql -U paystay -d paystay
```
or `database/scripts/psql.sh` (`psql.bat` on Windows). Then, for example:

```sql
\dt                                   -- list tables
SELECT * FROM "Rooms" ORDER BY "Number" LIMIT 10;
SELECT "Code", "CheckIn", "CheckOut", "Total", "Status" FROM "Bookings" ORDER BY "CreatedAt" DESC;
\q                                    -- leave
```
Table and column names are PascalCase, so they need double quotes. `queries.sql` has more.

**2. pgAdmin in the browser**:

```bash
docker compose --profile tools up -d
```
Open http://localhost:5050, sign in with `admin@example.com` / `paystay`, open *Servers → PayStay* and
enter the database password `paystay` once. Browse *Databases → paystay → Schemas → public → Tables*.

**3. Any desktop client** (DBeaver, TablePlus, DataGrip, the VS Code PostgreSQL extension): connect to
`localhost`, port `5433`, database `paystay`, user `paystay`, password `paystay`.

## Backups

```bash
database/scripts/backup.sh                       # writes paystay-<date>.dump
database/scripts/restore.sh paystay-<date>.dump  # restores it
```

## Starting over

To wipe all data and let the API recreate everything:

```bash
docker compose down -v        # -v deletes the paystay-pgdata volume
docker compose up --build
```
