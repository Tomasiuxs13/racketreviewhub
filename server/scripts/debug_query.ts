import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import * as dotenv from 'dotenv';
import { and, eq, or, sql, desc } from 'drizzle-orm';
dotenv.config();

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
const db = drizzle(client, { schema });
const rackets = schema.rackets;

async function main() {
  const allPublished = await db.select({ count: sql`count(*)` }).from(rackets).where(eq(rackets.isPublished, true));
  console.log("Published count:", allPublished);

  const test1 = await db.select({ count: sql`count(*)` }).from(rackets).where(
    and(
      eq(rackets.isPublished, true),
      or(eq(rackets.inStock, true), eq(rackets.padelMarketInStock, true))
    )
  );
  console.log("Published & in stock count:", test1);

  const test2 = await db.select({ count: sql`count(*)` }).from(rackets).where(
    and(
      eq(rackets.isPublished, true),
      or(eq(rackets.inStock, true), eq(rackets.padelMarketInStock, true)),
      sql`CAST(${rackets.currentPrice} as numeric) >= 40`
    )
  );
  console.log("Published & in stock & price >= 40 count:", test2);

  process.exit(0);
}

main().catch(console.error);
