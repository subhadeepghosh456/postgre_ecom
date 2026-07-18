# Express + TypeScript + Prisma 7 + PostgreSQL starter

## Setup

1. **Set your local DB credentials** in `.env`:

   ```
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ecom?schema=public"
   ```

   Use the real username/password of your local Postgres install, and make sure
   the `ecom` database exists (create it with `createdb ecom` or in psql:
   `CREATE DATABASE ecom;`).

2. **Create the tables** from the schema:

   ```
   npm run migrate        # prisma migrate dev — creates tables + migration files
   ```

3. **Run the dev server** (auto-reloads):

   ```
   npm run dev
   ```

   - Health check: http://localhost:3000/health
   - `GET/POST /api/users`
   - `GET/POST /api/products`

## Defining tables in separate files

Every `*.prisma` file inside **`prisma/schema/`** is merged into one schema, so
each table lives in its own file:

```
prisma/schema/
  schema.prisma    # generator + datasource ONLY (don't add models here)
  user.prisma      # model User
  product.prisma   # model Product
  order.prisma     # model Order + OrderItem
```

To add a new table, create e.g. `prisma/schema/category.prisma`, define your
`model Category { ... }`, then run:

```
npm run migrate        # applies the change to the DB
```

Relations across files work automatically (see `order.prisma` referencing
`User` and `Product`).

## How Prisma 7 is wired here

- The generated client goes to `src/generated/prisma` (gitignored; run
  `npm run prisma:generate` or it happens during `npm run build`).
- The DB connection uses a **driver adapter** (`@prisma/adapter-pg`) — see
  `src/lib/prisma.ts`. Prisma 7 no longer reads `url` from the schema.
- CLI/migrations config lives in `prisma.config.ts`.

## Scripts

| Script                    | What it does                                  |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Start server with hot reload (tsx)            |
| `npm run migrate`         | Create/apply migrations (`prisma migrate dev`)|
| `npm run prisma:generate` | Regenerate the Prisma client                  |
| `npm run studio`          | Open Prisma Studio (visual DB browser)        |
| `npm run build`           | Generate client + compile TypeScript to dist/ |
| `npm start`               | Run the compiled server  

- npx prisma migrate dev  
- npx prisma generate                   |
