/**
 * Extracts Pros and Cons lists from HTML review content.
 * Looks for <h3>Pros</h3> and <h3>Cons</h3> and grabs the subsequent <ul><li> items.
 */
export function extractProsCons(htmlContent: string | null | undefined): { pros: string[]; cons: string[] } {
    if (!htmlContent) return { pros: [], cons: [] };

    const pros: string[] = [];
    const cons: string[] = [];

    try {
        // A simple regex approach to find the UL following an H3 with Pros/Cons
        // Note: In a browser, DOMParser would be safer, but this runs in Node.js (seoInjector) as well.

        // Extract Pros
        const prosMatch = htmlContent.match(/<h3[^>]*>\s*Pros\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (prosMatch && prosMatch[1]) {
            const liMatches = Array.from(prosMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
            for (const match of liMatches) {
                // Strip HTML tags from the inner content
                const text = match[1].replace(/<[^>]*>/g, '').trim();
                if (text) pros.push(text);
            }
        }

        // Extract Cons
        const consMatch = htmlContent.match(/<h3[^>]*>\s*Cons\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (consMatch && consMatch[1]) {
            const liMatches = Array.from(consMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
            for (const match of liMatches) {
                // Strip HTML tags
                const text = match[1].replace(/<[^>]*>/g, '').trim();
                if (text) cons.push(text);
            }
        }
    } catch (e) {
        console.warn("Failed to parse pros/cons from HTML", e);
    }

    return { pros, cons };
}
