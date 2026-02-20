#!/usr/bin/env node
'use strict';

/**
 * ChatGPT API integration for generating padel racket reviews
 * Uses OpenAI API to generate reviews based on product specs and online sentiment
 */

const https = require('https');

// Load API key from environment or config
function getApiKey() {
  // Try environment variable first
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // Try config file
  try {
    const config = require('../config.json');
    if (config.openai && config.openai.apiKey) {
      return config.openai.apiKey;
    }
  } catch (error) {
    // Config file doesn't exist, that's okay
  }

  return null;
}

/**
 * Call ChatGPT API to generate review content
 */
async function generateReviewWithChatGPT(product, ratings) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable or create config.json with openai.apiKey');
  }

  const specs = product.specs || {};
  const productName = product.name;
  const brand = product.brand;
  const year = product.year;
  const playerName = product.playerName || 'Professional Player';
  const verdict = product.verdict || '';
  const price = product.price || '';

  // Build comprehensive prompt
  const prompt = `You are an expert padel racket reviewer. Generate a comprehensive review for the following padel racket in the EXACT structure specified below.

PRODUCT INFORMATION:
- Name: ${productName}
- Brand: ${brand}
- Year: ${year}
- Player: ${playerName}
- Price: ${price}
- Shape: ${specs.shape || 'Not specified'}
- Balance: ${specs.balance || 'Not specified'}
- Core: ${specs.core || 'Not specified'}
- Weight: ${specs.weight || 'Not specified'}
- Frame: ${specs.frame || 'Not specified'}
- Faces: ${specs.faces || 'Not specified'}
- Touch: ${specs.touch || 'Not specified'}
- Level: ${specs.level || 'Not specified'}

RATINGS (out of 10):
- Power: ${ratings.power}/10
- Control: ${ratings.control}/10
- Rebound: ${ratings.rebound}/10
- Maneuverability: ${ratings.maneuverability}/10
- Sweet Spot: ${ratings.sweetSpot}/10
- Overall: ${ratings.overall}/10

EXISTING DESCRIPTION:
${verdict.substring(0, 500)}

REQUIRED STRUCTURE - Generate the review in this EXACT format (use HTML tags as shown):

<p>[Introduction paragraph - 2-3 sentences about the racket, mentioning brand, name, year, and overall rating. Use <strong> tags for product name with year.]</p>

<h2>Technical Analysis</h2>

<h3>Shape and Balance</h3>
<p>[2-3 sentences about the shape and balance, explaining how they affect play. Use <strong> tags for key terms like "diamond shape" or "high balance".]</p>

<h3>Materials and Core</h3>
<p>[2-3 sentences about materials, core, and construction. Use <strong> tags for key materials like "carbon fiber" or "EVA core".]</p>

<h3>Technologies</h3>
<p>[2-3 sentences about technologies and features. Mention specific technologies if available in the description.]</p>

<h2>On the Court</h2>

<h3>From the Back of the Court</h3>
<p>[2-3 sentences about performance from the back. Mention control, power, sweet spot, and how it handles defensive situations.]</p>
<p>[1-2 additional sentences with more detail about back court play.]</p>

<h3>At the Net</h3>
<p>[2-3 sentences about net play performance. Mention volleys, power, control, and quick exchanges.]</p>
<p>[1-2 additional sentences with more detail about net play.]</p>

<h3>On Smash</h3>
<p>[2-3 sentences about smash performance. Mention power, control, and finishing ability.]</p>
<p>[1-2 additional sentences with more detail about smashes.]</p>

<h2>Performance Breakdown</h2>

<h3>Power (${ratings.power}/10)</h3>
<p>[2-3 sentences explaining the power rating, what contributes to it, and how it performs.]</p>

<h3>Control (${ratings.control}/10)</h3>
<p>[2-3 sentences explaining the control rating, what contributes to it, and how it performs.]</p>

<h3>Rebound (${ratings.rebound}/10)</h3>
<p>[2-3 sentences explaining the rebound rating, what contributes to it, and how it performs.]</p>

<h3>Maneuverability (${ratings.maneuverability}/10)</h3>
<p>[2-3 sentences explaining the maneuverability rating, what contributes to it, and how it performs.]</p>

<h3>Sweet Spot (${ratings.sweetSpot}/10)</h3>
<p>[2-3 sentences explaining the sweet spot rating, what contributes to it, and how it performs.]</p>

<h2>Who It's For</h2>
<p>The ${productName} is designed for <strong>[skill level] players</strong> who:</p>
<ul>
<li>[First characteristic]</li>
<li>[Second characteristic]</li>
<li>[Third characteristic]</li>
<li>[Fourth characteristic]</li>
<li>[Fifth characteristic]</li>
</ul>
<p>[Optional: Add a sentence about who it's NOT for, if applicable.]</p>

<h2>Pros & Cons</h2>
<div class="pros-cons">
<div class="pros">
<h3>Pros</h3>
<ul>
<li>[First pro]</li>
<li>[Second pro]</li>
<li>[Third pro]</li>
<li>[Fourth pro]</li>
<li>[Fifth pro]</li>
<li>[Sixth pro]</li>
</ul>
</div>
<div class="cons">
<h3>Cons</h3>
<ul>
<li>[First con]</li>
<li>[Second con]</li>
<li>[Third con]</li>
<li>[Fourth con]</li>
<li>[Fifth con]</li>
</ul>
</div>
</div>

<h2>Conclusion</h2>
<p>[2-3 sentences summarizing the racket, its strengths, and overall assessment. Use <strong> tags for product name with year.]</p>
<p>[1-2 additional sentences with final thoughts.]</p>
<p><strong>Overall Rating: ${ratings.overall}/10</strong></p>

IMPORTANT:
- Write in a professional, expert tone
- Base content on the specifications and ratings provided
- Be specific about how the racket performs
- Use the exact HTML structure shown above
- Include all sections in the order specified
- Make it informative and helpful for potential buyers
- Keep paragraphs concise (2-3 sentences each)
- Use <strong> tags appropriately for emphasis
- Do NOT include any markdown formatting, only HTML tags as shown`;

  const requestData = JSON.stringify({
    model: 'meta-llama/llama-3.1-70b-instruct', // Using OpenRouter Llama 3 for best review writing
    messages: [
      {
        role: 'system',
        content: 'You are an expert padel racket reviewer with deep knowledge of racket specifications, materials, and performance characteristics. You write detailed, professional reviews that help players make informed decisions.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 3000
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'Racket Review Hub',
        'Content-Length': requestData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI API error: ${response.error?.message || JSON.stringify(response)}`));
            return;
          }

          if (!response.choices || !response.choices[0] || !response.choices[0].message) {
            reject(new Error('Invalid response from OpenAI API'));
            return;
          }

          const reviewContent = response.choices[0].message.content;
          resolve(reviewContent);
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Parse ChatGPT response into structured review content
 */
function parseReviewContent(chatGPTResponse) {
  // The response should already be in HTML format matching our structure
  // We just need to extract it and ensure it's properly formatted

  // Remove any markdown code blocks if present
  let content = chatGPTResponse.trim();
  if (content.startsWith('```html')) {
    content = content.replace(/```html\n?/, '').replace(/```\n?$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/```\n?/, '').replace(/```\n?$/, '');
  }

  return content.trim();
}

module.exports = {
  generateReviewWithChatGPT,
  parseReviewContent,
  getApiKey
};




