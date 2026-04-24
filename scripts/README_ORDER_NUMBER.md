Prisma displayOrderNumber setup

What this does
- Adds a new `displayOrderNumber` integer column to `Order` that is autoincrementing.

Steps to apply
1. Run Prisma migration to apply schema changes:
   - `npx prisma migrate dev --name add-display-order-number`
2. After migration, run the SQL script to set the next value to 55253:
   - `psql <your_connection_string> -f scripts/set-order-seq.sql`
   - or run the commands inside `scripts/set-order-seq.sql` in your SQL client.

Notes
- The new column is `@unique` to prevent duplicate customer-facing numbers.
- If you already have production orders, backfill as needed before making the column non-nullable (this schema sets a default autoincrement so new rows get values automatically).
