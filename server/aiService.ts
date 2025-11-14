import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface RacketSpecs {
  brand: string;
  model: string;
  year: number;
  shape: string;
  currentPrice: string;
  originalPrice?: string;
}

interface GeneratedContent {
  reviewContent: string;
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
}

const REVIEW_TEMPLATE = `You are a professional padel racket reviewer. Generate a comprehensive review following this exact structure:

# Title Format
{BRAND} {MODEL}
{YEAR} Edition

# Opening Paragraph
Brief introduction mentioning the brand, model, target player level (beginner/intermediate/advanced), and overall rating out of 10.

# Technical Analysis Section

## Shape and Balance
Describe how the shape (diamond/round/teardrop) affects power generation, sweet spot, and playing characteristics. Explain balance point implications.

## Materials and Core
Discuss core material characteristics and construction (carbon fiber grade, materials used). Explain durability and response characteristics.

## Technologies
Describe special features like frame design, surface texture for spin, and any unique technologies.

# On the Court Section

## From the Back of the Court
Explain performance when playing from baseline: power, control, sweet spot, forgiveness. Discuss defensive capabilities and transition play.

## At the Net
Describe volley performance, blocking ability, quick exchange effectiveness. Explain how shape and balance affect net play.

## On Smash
Detail smash power, overhead effectiveness, energy transfer. Explain how construction affects aggressive finishing shots.

# Performance Breakdown
Provide ratings (0-10 scale) with detailed explanations for each:
- Power (X/10): Detailed description
- Control (X/10): Detailed description
- Rebound (X/10): Detailed description  
- Maneuverability (X/10): Detailed description
- Sweet Spot (X/10): Detailed description

# Who It's For
List ideal player characteristics in bullet points (skill level, playing style, priorities).

# Pros & Cons
List 3-5 pros and 2-4 cons in bullet points.

# Conclusion
Summarize with overall rating, value proposition, and final recommendation. End with "Overall Rating: X/10".

Generate realistic, detailed content based on the racket specifications. Use professional language but keep it accessible.`;

export async function generateRacketReview(specs: RacketSpecs): Promise<GeneratedContent> {
  try {
    const prompt = `${REVIEW_TEMPLATE}

Generate a detailed review for this padel racket:
- Brand: ${specs.brand}
- Model: ${specs.model}
- Year: ${specs.year}
- Shape: ${specs.shape}
- Price: €${specs.currentPrice}${specs.originalPrice ? ` (was €${specs.originalPrice})` : ''}

Create authentic, professional content that matches the quality of high-end padel review sites. Provide specific insights based on the shape and brand reputation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert padel equipment reviewer with deep knowledge of racket technology, materials, and performance characteristics. Write detailed, professional reviews."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const reviewContent = completion.choices[0].message.content || "";
    
    // Generate ratings based on shape and brand characteristics
    const ratings = await generateRatings(specs);

    return {
      reviewContent,
      ...ratings
    };
  } catch (error) {
    console.error("Error generating racket review:", error);
    throw new Error("Failed to generate racket review with AI");
  }
}

async function generateRatings(specs: RacketSpecs): Promise<{
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
}> {
  const prompt = `As a padel racket expert, provide performance ratings (0-100 scale) for this racket:
- Brand: ${specs.brand}
- Model: ${specs.model}
- Shape: ${specs.shape}

Consider:
- Diamond shapes: High power (85-95), moderate control (70-80), smaller sweet spot (65-75)
- Round shapes: Moderate power (70-80), high control (85-95), large sweet spot (85-95)
- Teardrop shapes: Balanced power (80-90), balanced control (80-90), medium sweet spot (75-85)
- Premium brands (Nox, Bullpadel, Head): +5-10 points across all metrics
- Mid-tier brands: Standard ranges

Return ONLY a JSON object with these keys: powerRating, controlRating, reboundRating, maneuverabilityRating, sweetSpotRating
Each value must be an integer between 0-100.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a padel equipment analyst. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const ratingsText = completion.choices[0].message.content || "{}";
    const ratings = JSON.parse(ratingsText);
    
    // Validate and ensure all ratings are present
    return {
      powerRating: Math.min(100, Math.max(0, ratings.powerRating || 75)),
      controlRating: Math.min(100, Math.max(0, ratings.controlRating || 75)),
      reboundRating: Math.min(100, Math.max(0, ratings.reboundRating || 75)),
      maneuverabilityRating: Math.min(100, Math.max(0, ratings.maneuverabilityRating || 75)),
      sweetSpotRating: Math.min(100, Math.max(0, ratings.sweetSpotRating || 75)),
    };
  } catch (error) {
    console.error("Error generating ratings:", error);
    // Fallback to shape-based defaults
    return getDefaultRatingsByShape(specs.shape);
  }
}

function getDefaultRatingsByShape(shape: string): {
  powerRating: number;
  controlRating: number;
  reboundRating: number;
  maneuverabilityRating: number;
  sweetSpotRating: number;
} {
  const shapeLower = shape.toLowerCase();
  
  if (shapeLower.includes('diamond')) {
    return {
      powerRating: 90,
      controlRating: 75,
      reboundRating: 80,
      maneuverabilityRating: 70,
      sweetSpotRating: 70,
    };
  } else if (shapeLower.includes('round')) {
    return {
      powerRating: 75,
      controlRating: 90,
      reboundRating: 85,
      maneuverabilityRating: 85,
      sweetSpotRating: 90,
    };
  } else { // teardrop
    return {
      powerRating: 85,
      controlRating: 85,
      reboundRating: 82,
      maneuverabilityRating: 80,
      sweetSpotRating: 80,
    };
  }
}
