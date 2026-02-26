import postgres from "postgres";

async function run() {
    const databaseUrl = "postgresql://racketreviewhub_db_user:C4aYY4VPvxBdmqpmBCMpvCPPYKtG736h@dpg-d4nbqt7gi27c738g4c8g-a.frankfurt-postgres.render.com/racketreviewhub_db";
    const client = postgres(databaseUrl, { ssl: { rejectUnauthorized: false } });

    console.log("Updating Carlos Rodrigues in database...");

    try {
        const result = await client`
      UPDATE authors 
      SET name = 'Carlos Rodrigues',
          slug = 'carlos-rodrigues',
          bio = 'Carlos Rodrigues is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.',
          avatar_url = '/assets/authors/carlos-rodrigues-avatar.png'
      WHERE slug = 'carlos-rodriguez' OR slug = 'carlos-rodrigues'
      RETURNING id, name;
    `;

        if (result.length > 0) {
            console.log("Successfully updated author:", result[0].name);
        } else {
            console.log("Author not found by slug. Inserting new one...");
            await client`
        INSERT INTO authors (name, slug, bio, avatar_url)
        VALUES (
          'Carlos Rodrigues', 
          'carlos-rodrigues', 
          'Carlos Rodrigues is a professional padel player and coach with over 15 years of technical experience. Known for his deep understanding of racket materials and power dynamics, he has tested hundreds of rackets to provide the most honest, performance-driven reviews in the industry.',
          '/assets/authors/carlos-rodrigues-avatar.png'
        );
      `;
            console.log("Inserted new author Carlos Rodrigues.");
        }
    } catch (err) {
        console.error("Error updating database:", err);
    } finally {
        await client.end();
    }
}

run();
