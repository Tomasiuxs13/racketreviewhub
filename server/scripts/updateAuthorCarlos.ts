import { db } from "../db";
import { authors } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function updateAuthor() {
    console.log("Updating author Carlos...");

    // Try to find by old slug or name
    const result = await db.update(authors)
        .set({
            name: "Carlos Rodrigues",
            slug: "carlos-rodrigues",
            bio: "Carlos Rodrigues is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.",
            avatarUrl: "/assets/authors/carlos-rodrigues.jpg"
        })
        .where(eq(authors.slug, "carlos-rodriguez"))
        .returning();

    if (result.length > 0) {
        console.log("Successfully updated author:", result[0].name);
    } else {
        // If not found by slug, maybe he already has the new slug or is missing
        const checkNew = await db.select().from(authors).where(eq(authors.slug, "carlos-rodrigues")).limit(1);
        if (checkNew.length > 0) {
            await db.update(authors)
                .set({
                    name: "Carlos Rodrigues",
                    bio: "Carlos Rodrigues is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.",
                    avatarUrl: "/assets/authors/carlos-rodrigues.jpg"
                })
                .where(eq(authors.slug, "carlos-rodrigues"));
            console.log("Updated author by new slug.");
        } else {
            console.log("Author Carlos Rodriguez not found by slug. Creating new...");
            await db.insert(authors).values({
                name: "Carlos Rodrigues",
                slug: "carlos-rodrigues",
                bio: "Carlos Rodrigues is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.",
                avatarUrl: "/assets/authors/carlos-rodrigues.jpg"
            });
        }
    }
}

updateAuthor().catch(console.error).finally(() => process.exit());
