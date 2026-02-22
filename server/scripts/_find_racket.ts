import "dotenv/config";
import { storage } from "../storage.js";

const searchTerm = process.argv[2]?.toLowerCase() || "hurricane";
const mode = process.argv.includes("--published") ? "published"
  : process.argv.includes("--all") ? "all" : "published";

const allRackets = await storage.getAllRackets();
const rackets = mode === "all" ? allRackets : allRackets.filter(r => r.isPublished === (mode === "published"));

for (let i = 0; i < rackets.length; i++) {
  const r = rackets[i];
  const fullName = `${r.brand} ${r.model}`.toLowerCase();
  if (fullName.includes(searchTerm)) {
    console.log(`#${i + 1}: ${r.brand} ${r.model} (${r.year}) [published=${r.isPublished}]`);
  }
}
console.log(`\nTotal in list: ${rackets.length}`);
process.exit(0);
