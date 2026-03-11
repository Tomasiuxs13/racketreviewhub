import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import * as dotenv from 'dotenv';
import { and, eq, or, desc, sql } from 'drizzle-orm';
dotenv.config();

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
const db = drizzle(client, { schema });
const rackets = schema.rackets;

async function main() {
  console.log("Fetching Top 30 Best Rackets (using new filters)...");
  
  const conditions = [
    eq(rackets.isPublished, true),
    or(eq(rackets.inStock, true), eq(rackets.padelMarketInStock, true)),
    sql`CAST(${rackets.currentPrice} as numeric) >= 40`
  ];

  const top30 = await db
    .select()
    .from(rackets)
    .where(and(...conditions))
    .orderBy(desc(rackets.overallRating))
    .limit(30);
  
  console.log(`Found ${top30.length} rackets.`);
  
  let validLinks = 0;
  top30.forEach((racket, index) => {
    const hasCj = !!racket.affiliateLink;
    const hasPm = !!racket.padelMarketAffiliateLink;
    if (hasCj || hasPm) validLinks++;
    
    console.log(`${index + 1}. ${racket.brand} ${racket.model} (${racket.year}) | €${racket.currentPrice} | Rating: ${racket.overallRating}`);
    console.log(`   CJ Link: ${hasCj ? 'Yes' : 'No'}, PM Link: ${hasPm ? 'Yes' : 'No'}`);
  });
  
  console.log(`\nSummary: ${validLinks} out of ${top30.length} items have affiliate links.`);
  process.exit(0);
}

main().catch(console.error);
