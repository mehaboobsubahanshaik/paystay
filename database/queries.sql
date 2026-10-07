-- Handy queries for checking PayStay data. Run any of them in psql or pgAdmin.
-- Note: table and column names are PascalCase, so they need double quotes.

-- All tables
\dt

-- Row counts
SELECT 'Users' AS tbl, count(*) FROM "Users"
UNION ALL SELECT 'Rooms', count(*) FROM "Rooms"
UNION ALL SELECT 'Bookings', count(*) FROM "Bookings"
UNION ALL SELECT 'ServiceRequests', count(*) FROM "ServiceRequests"
UNION ALL SELECT 'ReferralCodes', count(*) FROM "ReferralCodes";

-- The owner account
SELECT "Mobile", "Name", "Role", "CreatedAt" FROM "Users" WHERE "Role" = 'Owner';

-- Tonight's room board: who is in which room
SELECT r."Number", r."Floor", r."Type", r."Price",
       COALESCE(u."Name", '') AS guest,
       CASE WHEN b."Id" IS NOT NULL THEN 'booked' ELSE lower(r."Status") END AS status
FROM "Rooms" r
LEFT JOIN "Bookings" b ON b."RoomId" = r."Id" AND b."Status" = 'Confirmed'
     AND b."CheckIn" <= CURRENT_DATE AND CURRENT_DATE < b."CheckOut"
LEFT JOIN "Users" u ON u."Id" = b."UserId"
ORDER BY r."Number";

-- Latest bookings with guest and room
SELECT b."Code", u."Name" AS guest, r."Number" AS room, b."CheckIn", b."CheckOut",
       b."ArrivalTime", b."Guests", b."Total", b."Status", b."CreatedAt"
FROM "Bookings" b
JOIN "Users" u ON u."Id" = b."UserId"
JOIN "Rooms" r ON r."Id" = b."RoomId"
ORDER BY b."CreatedAt" DESC
LIMIT 20;

-- Open guest requests (what the owner's Requests page shows)
SELECT s."Kind", s."Status", r."Number" AS room, u."Name" AS guest, s."Items", s."When", s."Total", s."CreatedAt"
FROM "ServiceRequests" s
JOIN "Bookings" b ON b."Id" = s."BookingId"
JOIN "Rooms" r ON r."Id" = b."RoomId"
JOIN "Users" u ON u."Id" = b."UserId"
WHERE s."Status" IN ('New', 'Accepted')
ORDER BY s."CreatedAt" DESC;

-- Rooms booked per night for the next 7 nights
SELECT d::date AS night,
       (SELECT count(*) FROM "Bookings" b WHERE b."Status" = 'Confirmed' AND b."CheckIn" <= d AND d < b."CheckOut") AS booked
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day') AS d;

-- Referral codes and how often each was used
SELECT rc."Code", u."Name" AS earned_by,
       (SELECT count(DISTINCT b."GroupId") FROM "Bookings" b WHERE b."ReferralCode" = rc."Code" AND b."Status" = 'Confirmed') AS uses
FROM "ReferralCodes" rc
JOIN "Users" u ON u."Id" = rc."OwnerUserId"
ORDER BY rc."CreatedAt" DESC;

-- Check the double-booking guard exists
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_no_overlap';
