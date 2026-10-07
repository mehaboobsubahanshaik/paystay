# PayStay Hyderabad

Hotel booking app for one hotel, PayStay Hyderabad. Guests sign in with their mobile number, book rooms,
order room service and plan their trip. The owner sees the room board, every booking and every guest request
update live.

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Recharts, Axios, React Router, SignalR client |
| Backend | ASP.NET Core 8 Web API (C#), Entity Framework Core, JWT + OTP, SignalR, Swagger |
| Database | PostgreSQL 16 |
| Run | Docker Compose (containers `paystay-db`, `paystay-api`, `paystay-web`), or locally with the .NET SDK and Node |

```
paystay/
├── backend/
│   ├── PayStay.sln
│   └── PayStay.Api/          ASP.NET Core Web API
│       ├── Controllers/      Auth, Catalog, Customer, Owner
│       ├── Services/         Booking, Request, Owner, Otp, Token, Catalog, Pricing
│       ├── Data/             AppDbContext, DbInitializer, SampleData
│       ├── Hubs/             HotelHub (SignalR)
│       ├── Models/           Entities
│       └── Dtos/             Request / response shapes
├── frontend/                 React + TypeScript (Vite)
│   └── src/
│       ├── api/              Axios client and DTO types
│       ├── lib/              Auth context, SignalR hook, formatting
│       ├── components/       Shell, UI pieces, owner widgets, tour
│       └── pages/            Login, guest/ (Book, Trips, RoomServices), owner/ (Dashboard, Rooms, Bookings, Requests, Analytics)
├── database/                 PostgreSQL
│   ├── Dockerfile            postgres:16 + init scripts
│   ├── init/                 runs once on first start
│   ├── schema.sql            reference copy of the tables
│   ├── queries.sql           ready-made queries
│   └── scripts/              psql shell, backup, restore
├── docker-compose.yml        db + api + web (+ optional pgAdmin)
└── .github/workflows/ci.yml  builds both on every push
```

## Run with Docker (easiest)

Needs Docker Desktop.

```bash
docker compose up --build
```

| What | Where | Container |
|---|---|---|
| App | http://localhost:8090 | `paystay-web` |
| API + Swagger | http://localhost:5090/swagger | `paystay-api` |
| PostgreSQL | localhost:5433, user `paystay`, password `paystay`, database `paystay` | `paystay-db` |

The API creates the tables, the 50 rooms and the owner account on first start.
`docker compose ps` shows the three containers; `docker compose logs -f api` follows the API log
(the OTP codes are printed there too).

### Changing ports

If a port is already used by another project, copy `.env.example` to `.env` and edit it:

```
WEB_PORT=8090      # the app
API_PORT=5090      # API and Swagger
DB_PORT=5433       # PostgreSQL
```

Then run `docker compose up --build` again. Nothing else needs changing; the web container
forwards API calls internally, so the API port only matters for opening Swagger yourself.

### Checking the database

The quickest way is a SQL shell inside the database container:

```bash
docker exec -it paystay-db psql -U paystay -d paystay
```
```sql
\dt                                             -- list tables
SELECT * FROM "Rooms" ORDER BY "Number" LIMIT 10;
SELECT "Code", "CheckIn", "CheckOut", "Total", "Status" FROM "Bookings" ORDER BY "CreatedAt" DESC;
\q
```
Table and column names need double quotes (they are PascalCase). `database/queries.sql` has ready-made
queries for the room board, bookings, open requests, occupancy and referrals.

For a visual browser, start pgAdmin alongside the app:

```bash
docker compose --profile tools up -d
```
Open http://localhost:5050 (sign in `admin@example.com` / `paystay`), open *Servers → PayStay*, and enter
the database password `paystay`. Any desktop client (DBeaver, TablePlus, DataGrip) also works with
host `localhost`, port `5433`. See `database/README.md` for backups and more.

## Run locally (for development)

Needs the .NET 8 SDK, Node 20+, and a PostgreSQL server (or `docker compose up db` for just the database).

**1. Database** (skip if you already have PostgreSQL with a `paystay` user):

```bash
docker compose up db
```

**2. API** (terminal 1):

```bash
cd backend/PayStay.Api
dotnet run
```
Runs on http://localhost:5090 with Swagger at /swagger. The connection string in `appsettings.json`
points at port 5433 (the `docker compose up db` database). For a different port:
`dotnet run --urls http://localhost:5091`.

**3. Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
```
Opens http://localhost:5173. Vite proxies `/api` and `/hubs` to the API, so no CORS setup is needed.
For different ports, copy `frontend/.env.example` to `frontend/.env` and set `VITE_PORT` and
`VITE_API_TARGET` (or pass them inline: `VITE_PORT=5174 npm run dev`).

## Try it

**Guest:** choose *Guest*, enter any 10-digit mobile number starting with 6–9, and type the 6-digit code shown
on screen (OTP runs in Mock mode: no SMS is sent, the code is returned by the API and also written to the API log).

**Owner:** choose *Hotel owner*, number `90000 00001`, then the code on screen. On the dashboard, *Load sample
bookings* fills the hotel with demo guests, bookings and requests; *Remove sample data* clears them.

**Live updates:** open the app in two browsers (or a phone and a laptop on the same network). Sign in as owner in
one and as a guest in the other. Book a room, order food or book the city tour as the guest: the owner's room
board, feed and Requests badge update at once through SignalR, and the guest sees each status change the owner makes.

## Features

**Guests**
- Mobile number + OTP sign-in (JWT, 24 h)
- Search by check-in date, arrival time (any half hour, early check-in, late arrival, or "not sure yet"), nights, guests and rooms; book up to 5 rooms at once
- Room cards with type, floor, amenities and price; GST (5% up to ₹7,500, 18% above) at checkout
- My trips as boarding-pass tickets: change arrival time, cancel until the day before check-in
- Room services: housekeeping, in-room dining menu, cabs, and live request status
- Hyderabad in a Day tour: ₹499 per person or ₹1,499 family pack of 4, food on your own
- Referral code earned for 5+ nights in a row; friends get 10% off room charges
- Links to flights (Google Flights), trains (IRCTC) and cabs (Uber)

**Owner**
- Dashboard: total / booked / available / not-ready rooms, colour-coded room board, tonight's split, live bookings feed, open guest requests, rooms booked per night (Recharts)
- Rooms: mark cleaning / maintenance / ready; see who is in house
- Bookings: search, filter, cancel
- Requests: accept and complete housekeeping, food, cab and tour requests; guests are notified live
- Analytics: booking value, 14-night occupancy, average stay, room types, referrals

## API

All routes are under `/api`. Swagger lists every one with its request and response shapes.

| Area | Routes | Who |
|---|---|---|
| Auth | `POST auth/otp/request`, `POST auth/otp/verify` | anyone |
| Catalog | `GET catalog` | anyone |
| Customer | `GET/PUT customer/profile`, `GET customer/rooms/available`, `GET/POST customer/bookings`, `POST customer/bookings/{id}/cancel`, `PATCH customer/bookings/{id}/arrival`, `POST customer/referrals/check`, `GET customer/referrals`, `GET/POST customer/bookings/{id}/requests`, `POST customer/requests/{id}/cancel` | role Customer |
| Owner | `GET owner/dashboard`, `GET owner/analytics`, `GET owner/rooms`, `PUT owner/rooms/{id}/status`, `GET owner/bookings`, `POST owner/bookings/{id}/cancel`, `GET owner/requests`, `PUT owner/requests/{id}/status`, `POST/DELETE owner/sample-data` | role Owner |
| Live | SignalR hub at `/hubs/hotel`, event `changed` | signed-in users |

A customer token on an `/api/owner/*` route gets 403, enforced by `[Authorize(Roles = "Owner")]`.

## Database

| Table | Purpose |
|---|---|
| Users | Mobile, name, role (Customer / Owner) |
| OtpCodes | Hashed one-time codes with expiry and attempt counts |
| Rooms | 50 rooms: number, floor, type, price, capacity, housekeeping status |
| Bookings | One row per room per stay; rooms booked together share a GroupId |
| ServiceRequests | Housekeeping, dining, cab and tour requests with items (jsonb) and status |
| ReferralCodes | Codes earned by long stays |

Double bookings are blocked twice: the API locks the rooms in a transaction, and PostgreSQL has an exclusion
constraint (`bookings_no_overlap`) so two confirmed bookings for one room can never overlap, whatever the code does.
The schema is created with `EnsureCreated` on first run. To switch to EF migrations:
`dotnet tool install -g dotnet-ef`, then `dotnet ef migrations add Initial` in `backend/PayStay.Api`.

## Settings

| Setting | Where | Default |
|---|---|---|
| Owner mobile number | `Owner:Mobile` in appsettings.json or `OWNER_MOBILE` in .env | 9000000001 |
| JWT signing key | `Jwt:Key` / `JWT_KEY` (at least 32 characters; change it before going live) | dev key |
| OTP mode | `Otp:Mode` (`Mock` returns the code in the response) | Mock |
| Room types, prices, menu, cabs, tour | `Services/Catalog.cs` | see file |
| Referral rule and discount, GST | `Services/Pricing.cs` | 5 nights, 10% |
| Allowed web origins | `Cors:Origins` | localhost:5173, localhost:8090 |
| Ports (Docker) | `WEB_PORT`, `API_PORT`, `DB_PORT` in `.env` | 8090, 5090, 5433 |

## Going to production

- Replace `ConsoleSmsSender` with an SMS provider (MSG91 or Twilio Verify) and set `Otp:Mode` to anything other than `Mock`. SMS in India needs DLT registration.
- Set a long random `JWT_KEY` and a real database password.
- Set `VITE_API_URL` when the frontend and API are on different hosts, and add that host to `Cors:Origins`.
- Azure: App Service for the API, Static Web Apps for the frontend, Azure Database for PostgreSQL. Redis is optional: add it for OTP rate limiting across several API instances and as a SignalR backplane.
