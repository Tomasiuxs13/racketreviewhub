#!/usr/bin/env npx tsx
/**
 * Utility script to generate a bcrypt password hash for admin authentication.
 * 
 * Usage:
 *   npx tsx server/scripts/generatePasswordHash.ts "your-password"
 * 
 * Then add the generated hash to your environment variables as ADMIN_PASSWORD_HASH
 */

import bcrypt from "bcryptjs";

async function main() {
  const password = process.argv[2];
  
  if (!password) {
    console.error("Usage: npx tsx server/scripts/generatePasswordHash.ts <password>");
    console.error("Example: npx tsx server/scripts/generatePasswordHash.ts 'mySecurePassword123'");
    process.exit(1);
  }
  
  console.log("\n🔐 Generating password hash...\n");
  
  const hash = await bcrypt.hash(password, 10);
  
  console.log("Generated hash:");
  console.log("================");
  console.log(hash);
  console.log("================\n");
  
  console.log("Add this to your environment variables:");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  
  // Verify the hash works
  const isValid = await bcrypt.compare(password, hash);
  console.log(`✅ Hash verification: ${isValid ? "PASSED" : "FAILED"}`);
}

main().catch(console.error);


