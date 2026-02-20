import { storage } from './server/storage.js';

async function main() {
    const rackets = await storage.getAllRackets({ limit: 5 });
    const racket = rackets.find(r => r.brand === 'WILSON' && r.model.includes('OPTIX V2 POWER Blue'));

    if (!racket) {
        console.log('Racket not found.');
        process.exit(1);
    }

    console.log('--- RATINGS ---');
    console.log(`Power: ${racket.powerRating}`);
    console.log(`Control: ${racket.controlRating}`);
    console.log(`Overall: ${racket.overallRating}`);

    console.log('\n--- RESEARCH ---');
    console.log(racket.researchBrief);

    console.log('\n--- REVIEW CONTENT ---');
    console.log(racket.reviewContent);
}

main().catch(console.error);
