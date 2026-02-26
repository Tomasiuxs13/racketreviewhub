import postgres from "postgres";

async function run() {
    const databaseUrl = "postgresql://racketreviewhub_db_user:C4aYY4VPvxBdmqpmBCMpvCPPYKtG736h@dpg-d4nbqt7gi27c738g4c8g-a.frankfurt-postgres.render.com/racketreviewhub_db";
    const client = postgres(databaseUrl, { ssl: { rejectUnauthorized: false } });

    console.log("Reverting Carlos back to Rodriguez in database...");

    try {
        const result = await client`
      UPDATE authors 
      SET name = 'Carlos Rodriguez',
          slug = 'carlos-rodriguez',
          bio = 'Carlos Rodriguez is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.',
          avatar_url = '/assets/authors/carlos-rodriguez-avatar.png'
      WHERE slug = 'carlos-rodrigues' OR slug = 'carlos-rodriguez'
      RETURNING id, name;
    `;

        if (result.length > 0) {
            console.log("Successfully updated author back to:", result[0].name);
        } else {
            console.log("Author not found. Ensuring Carlos Rodriguez exists...");
            await client`
        INSERT INTO authors (name, slug, bio, avatar_url)
        VALUES (
          'Carlos Rodriguez', 
          'carlos-rodriguez', 
          'Carlos Rodriguez is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.',
          '/assets/authors/carlos-rodriguez-avatar.png'
        )
        ON CONFLICT (slug) DO UPDATE SET 
          name = EXCLUDED.name,
          bio = EXCLUDED.bio,
          avatar_url = EXCLUDED.avatar_url;
      `;
            console.log("Carlos Rodriguez profile ensured.");
        }
    } catch (err) {
        console.error("Error updating database:", err);
    } finally {
        await client.end();
    }
}

run();
