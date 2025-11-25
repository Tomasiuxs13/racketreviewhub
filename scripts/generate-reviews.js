#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const xlsx = require('xlsx');
const { generateReviewWithChatGPT, parseReviewContent, getApiKey } = require('./chatgpt-review-generator');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const ARTICLES_DIR = path.resolve(ROOT_DIR, 'articles');
const REVIEWS_DIR = path.resolve(ARTICLES_DIR, 'reviews');
const BEST_LISTS_DIR = path.resolve(ARTICLES_DIR, 'best-lists');
const DEFAULT_SOURCE = path.resolve(DATA_DIR, 'Padel Rackets - Online Shopping _ Pādel Nuestro.numbers');
const DEFAULT_MERGED = path.resolve(DATA_DIR, 'merged-products.json');

/**
 * Calculate ratings based on product specifications
 */
function calculateRatings(product) {
  const specs = product.specs || {};
  const shape = (specs.shape || '').toLowerCase();
  const balance = (specs.balance || '').toLowerCase();
  const core = (specs.core || '').toLowerCase();
  const weight = (specs.weight || '').toLowerCase();
  const frame = (specs.frame || '').toLowerCase();
  const faces = (specs.faces || '').toLowerCase();
  const touch = (specs.touch || '').toLowerCase();
  const level = (specs.level || '').toLowerCase();

  // Power calculation
  let power = 5.0; // Base
  if (shape.includes('diamond') || shape.includes('power')) power += 2.5;
  else if (shape.includes('teardrop')) power += 1.0;
  else if (shape.includes('round')) power += 0.0;
  
  if (balance.includes('high')) power += 1.5;
  else if (balance.includes('medium') || balance.includes('medio')) power += 0.5;
  
  if (core.includes('18k') || core.includes('24k') || core.includes('carbon 18k') || core.includes('carbon 24k')) power += 1.0;
  else if (core.includes('12k') || core.includes('carbon 12k')) power += 0.5;
  else if (core.includes('high memory') || core.includes('eva high memory')) power += 0.8;
  else if (core.includes('soft') || core.includes('eva soft')) power -= 0.5;
  
  if (frame.includes('oversize') || faces.includes('oversize')) power += 0.5;
  if (touch.includes('rough') || touch.includes('rugosa')) power += 0.3;
  
  // Extract weight number if available
  const weightMatch = weight.match(/(\d{3})/);
  if (weightMatch) {
    const weightNum = parseInt(weightMatch[1], 10);
    if (weightNum >= 370) power += 0.5;
    else if (weightNum <= 340) power -= 0.5;
  }

  // Control calculation
  let control = 5.0; // Base
  if (shape.includes('round')) control += 2.5;
  else if (shape.includes('teardrop')) control += 1.5;
  else if (shape.includes('diamond') || shape.includes('power')) control -= 1.0;
  
  if (balance.includes('low') || balance.includes('bajo')) control += 1.5;
  else if (balance.includes('medium') || balance.includes('medio')) control += 0.5;
  else if (balance.includes('high')) control -= 0.5;
  
  if (core.includes('soft') || core.includes('eva soft performance')) control += 1.0;
  else if (core.includes('high memory') || core.includes('eva high memory')) control -= 0.5;
  else if (core.includes('multieva')) control += 0.3;
  
  if (frame.includes('control')) control += 0.5;
  if (touch.includes('smooth') || touch.includes('lisa')) control += 0.3;

  // Rebound calculation
  let rebound = 5.0; // Base
  if (core.includes('high memory') || core.includes('eva high memory')) rebound += 2.0;
  else if (core.includes('multieva')) rebound += 1.5;
  else if (core.includes('soft') || core.includes('eva soft')) rebound += 0.5;
  
  if (core.includes('18k') || core.includes('24k') || core.includes('carbon 18k') || core.includes('carbon 24k')) rebound += 1.0;
  else if (core.includes('12k') || core.includes('carbon 12k')) rebound += 0.5;
  
  if (frame.includes('oversize') || faces.includes('oversize')) rebound += 0.5;

  // Maneuverability calculation
  let maneuverability = 5.0; // Base
  if (weightMatch) {
    const weightNum = parseInt(weightMatch[1], 10);
    if (weightNum <= 340) maneuverability += 2.0;
    else if (weightNum <= 350) maneuverability += 1.0;
    else if (weightNum >= 370) maneuverability -= 1.5;
    else if (weightNum >= 360) maneuverability -= 0.5;
  }
  
  if (balance.includes('low') || balance.includes('bajo')) maneuverability += 1.5;
  else if (balance.includes('high')) maneuverability -= 1.0;
  
  if (shape.includes('round')) maneuverability += 0.5;
  else if (shape.includes('diamond') || shape.includes('power')) maneuverability -= 0.5;

  // Sweet Spot calculation
  let sweetSpot = 5.0; // Base
  if (shape.includes('round')) sweetSpot += 2.5;
  else if (shape.includes('teardrop')) sweetSpot += 1.5;
  else if (shape.includes('diamond') || shape.includes('power')) sweetSpot -= 1.5;
  
  if (frame.includes('oversize') || faces.includes('oversize')) sweetSpot += 1.5;
  else if (frame.includes('normal') || faces.includes('normal')) sweetSpot += 0.5;

  // Clamp all values between 0 and 10
  power = Math.max(0, Math.min(10, power));
  control = Math.max(0, Math.min(10, control));
  rebound = Math.max(0, Math.min(10, rebound));
  maneuverability = Math.max(0, Math.min(10, maneuverability));
  sweetSpot = Math.max(0, Math.min(10, sweetSpot));

  // Overall rating (weighted average)
  const overall = (
    power * 0.25 +
    control * 0.25 +
    rebound * 0.15 +
    maneuverability * 0.15 +
    sweetSpot * 0.20
  );

  return {
    power: Math.round(power * 10) / 10,
    control: Math.round(control * 10) / 10,
    rebound: Math.round(rebound * 10) / 10,
    maneuverability: Math.round(maneuverability * 10) / 10,
    sweetSpot: Math.round(sweetSpot * 10) / 10,
    overall: Math.round(overall * 10) / 10
  };
}

/**
 * Generate AI-based review content
 */
function generateReviewContent(product, ratings) {
  const specs = product.specs || {};
  const shape = specs.shape || 'Unknown';
  const balance = specs.balance || 'Unknown';
  const core = specs.core || 'Unknown';
  const weight = specs.weight || 'Unknown';
  const frame = specs.frame || 'Unknown';
  const faces = specs.faces || 'Unknown';
  const touch = specs.touch || 'Unknown';
  const level = specs.level || 'Unknown';
  const verdict = product.verdict || '';
  
  const productName = product.name;
  const brand = product.brand;
  const year = product.year;
  const playerName = product.playerName || 'Professional Player';

  // Determine shape type
  const isDiamond = shape.toLowerCase().includes('diamond') || shape.toLowerCase().includes('power');
  const isRound = shape.toLowerCase().includes('round');
  const isTeardrop = shape.toLowerCase().includes('teardrop') || (!isDiamond && !isRound);
  
  // Determine balance type
  const isHighBalance = balance.toLowerCase().includes('high') || balance.toLowerCase().includes('alto');
  const isLowBalance = balance.toLowerCase().includes('low') || balance.toLowerCase().includes('bajo');
  const isMediumBalance = !isHighBalance && !isLowBalance;
  
  // Determine skill level
  const isAdvanced = level.toLowerCase().includes('advanced') || level.toLowerCase().includes('professional') || level.toLowerCase().includes('competition');
  const isBeginner = level.toLowerCase().includes('beginner') || level.toLowerCase().includes('junior');
  const isIntermediate = !isAdvanced && !isBeginner;

  // Introduction
  const intro = generateIntroduction(productName, brand, year, ratings.overall, isDiamond, isRound, isTeardrop);

  // Technical Analysis
  const technicalAnalysis = generateTechnicalAnalysis(shape, balance, core, weight, frame, faces, touch, specs);

  // On the Court
  const onTheCourt = generateOnTheCourt(isDiamond, isRound, isTeardrop, isHighBalance, isLowBalance, ratings);

  // Performance Breakdown
  const performanceBreakdown = generatePerformanceBreakdown(ratings);

  // Who It's For
  const whoItsFor = generateWhoItsFor(isAdvanced, isBeginner, isIntermediate, isDiamond, isRound, isTeardrop, ratings);

  // Pros & Cons
  const prosCons = generateProsCons(isDiamond, isRound, isTeardrop, isHighBalance, isLowBalance, ratings, specs);

  // Conclusion
  const conclusion = generateConclusion(productName, brand, year, ratings.overall, isDiamond, isRound, isTeardrop);

  return {
    intro,
    technicalAnalysis,
    onTheCourt,
    performanceBreakdown,
    whoItsFor,
    prosCons,
    conclusion
  };
}

function generateIntroduction(name, brand, year, overallRating, isDiamond, isRound, isTeardrop) {
  const focus = isDiamond ? 'power' : isRound ? 'control' : 'versatility';
  // Check if name already includes the year
  const nameWithYear = name.includes(year) ? name : `${name} ${year}`;
  return `${brand} continues to impress with the <strong>${nameWithYear}</strong>, a padel racket that delivers ${focus === 'power' ? 'explosive power' : focus === 'control' ? 'exceptional control' : 'balanced performance'} for ${overallRating >= 8.5 ? 'advanced' : overallRating >= 7.5 ? 'intermediate to advanced' : 'intermediate'} players. With an overall rating of ${overallRating}/10, this racket ${overallRating >= 8.5 ? 'stands out' : overallRating >= 7.5 ? 'offers solid performance' : 'provides good value'} in its category.`;
}

function generateTechnicalAnalysis(shape, balance, core, weight, frame, faces, touch, specs) {
  let html = '<h2>Technical Analysis</h2>\n\n';
  
  html += '<h3>Shape and Balance</h3>\n';
  const shapeDesc = shape.toLowerCase().includes('diamond') || shape.toLowerCase().includes('power')
    ? 'The diamond shape concentrates weight in the head, maximizing power generation and aggressive shot-making. This design favors offensive players who dominate at the net.'
    : shape.toLowerCase().includes('round')
    ? 'The round shape distributes weight evenly, providing excellent control and a larger sweet spot. This design is ideal for players who prioritize precision and placement.'
    : 'The teardrop shape offers a balanced approach, combining elements of both power and control. This versatile design suits players who want flexibility in their game.';
  
  const balanceDesc = balance.toLowerCase().includes('high') || balance.toLowerCase().includes('alto')
    ? 'The high balance point enhances power and aggressive play, making it easier to generate speed on smashes and volleys.'
    : balance.toLowerCase().includes('low') || balance.toLowerCase().includes('bajo')
    ? 'The low balance point improves control and maneuverability, allowing for precise placement and quick reactions.'
    : 'The medium balance provides a good compromise between power and control, suitable for versatile playing styles.';
  
  html += `<p>${shapeDesc} ${balanceDesc}</p>\n\n`;

  html += '<h3>Materials and Core</h3>\n';
  const coreDesc = core.toLowerCase().includes('high memory') || core.toLowerCase().includes('eva high memory')
    ? 'The High Memory EVA core provides excellent energy return and responsiveness, translating to powerful shots with good ball output.'
    : core.toLowerCase().includes('soft') || core.toLowerCase().includes('eva soft')
    ? 'The Soft EVA core offers enhanced comfort and ball pocketing, providing better control and reduced vibrations.'
    : core.toLowerCase().includes('multieva')
    ? 'The MultiEVA core balances power and control, offering a versatile feel that adapts to different playing situations.'
    : 'The core material provides a balanced response, suitable for various playing styles.';
  
  const carbonDesc = core.toLowerCase().includes('18k') || core.toLowerCase().includes('24k')
    ? 'The high-grade carbon fiber construction (18k/24k) ensures maximum stiffness and power transfer, while maintaining excellent durability.'
    : core.toLowerCase().includes('12k')
    ? 'The carbon fiber construction provides good stiffness and power, offering a solid balance between performance and value.'
    : 'The construction materials ensure reliable performance and durability.';
  
  html += `<p>${coreDesc} ${carbonDesc}</p>\n\n`;

  html += '<h3>Technologies</h3>\n';
  const techDesc = frame.toLowerCase().includes('oversize') || faces.toLowerCase().includes('oversize')
    ? 'The oversized frame increases the sweet spot and provides more power on off-center hits, making the racket more forgiving.'
    : 'The frame design optimizes the balance between power and control, ensuring consistent performance across different shot types.';
  
  const touchDesc = touch.toLowerCase().includes('rough') || touch.toLowerCase().includes('rugosa')
    ? 'The rough surface texture enhances spin generation, allowing for more effective topspin and slice shots.'
    : 'The surface finish provides good grip on the ball, enabling controlled spin when needed.';
  
  html += `<p>${techDesc} ${touchDesc}</p>\n`;

  return html;
}

function generateOnTheCourt(isDiamond, isRound, isTeardrop, isHighBalance, isLowBalance, ratings) {
  let html = '<h2>On the Court</h2>\n\n';

  html += '<h3>From the Back of the Court</h3>\n';
  if (isDiamond && isHighBalance) {
    html += `<p>Playing from the back with this racket requires ${ratings.control >= 7 ? 'good' : 'refined'} technique due to its ${ratings.sweetSpot >= 7 ? 'moderate' : 'smaller'} sweet spot and high balance. The power-oriented design means you need excellent timing to defend effectively, but rewards clean contact with ${ratings.power >= 8 ? 'exceptional' : 'impressive'} power and the ability to transition from defense to offense quickly.</p>\n`;
    html += `<p>The diamond shape and high balance make it ${ratings.control >= 7 ? 'less forgiving' : 'demanding'} from the back, requiring consistent contact. However, when you connect cleanly, the power is ${ratings.power >= 8 ? 'exceptional' : 'impressive'}, allowing you to hit deep, penetrating shots that put pressure on your opponents.</p>\n\n`;
  } else if (isRound && isLowBalance) {
    html += `<p>From the back of the court, this racket excels with its ${ratings.control >= 8 ? 'exceptional' : 'excellent'} control and ${ratings.sweetSpot >= 8 ? 'large' : 'generous'} sweet spot. The round shape and low balance make it ${ratings.maneuverability >= 8 ? 'highly' : 'very'} maneuverable, allowing for precise placement and quick defensive reactions.</p>\n`;
    html += `<p>The forgiving nature of this racket makes it ideal for players who want confidence in their defensive shots. You can consistently place the ball where you want, even under pressure, making it easier to control rallies from the back.</p>\n\n`;
  } else {
    html += `<p>From the back of the court, this racket offers a ${ratings.control >= 7.5 ? 'good' : 'balanced'} combination of control and power. The design allows for ${ratings.control >= 7 ? 'precise' : 'consistent'} placement while still providing enough power to hit deep shots when needed.</p>\n`;
    html += `<p>The ${ratings.sweetSpot >= 7 ? 'moderate to large' : 'moderate'} sweet spot provides ${ratings.control >= 7 ? 'good' : 'adequate'} forgiveness, making it easier to maintain control during defensive situations while still being able to attack when opportunities arise.</p>\n\n`;
  }

  html += '<h3>At the Net</h3>\n';
  if (isDiamond && isHighBalance) {
    html += `<p>At the net, this racket truly shines. The aggressive design grants ${ratings.power >= 8 ? 'exceptional' : 'impressive'} power on volleys and trays. Despite its emphasis on power, it provides ${ratings.control >= 7 ? 'enough' : 'adequate'} control for precise net play, making each block or consecutive volley an assertive statement.</p>\n`;
    html += `<p>The high balance and diamond shape excel at the net, where aggressive players can dominate. Quick exchanges favor this racket, and the power allows you to finish points decisively.</p>\n\n`;
  } else if (isRound && isLowBalance) {
    html += `<p>At the net, this racket provides ${ratings.control >= 8 ? 'exceptional' : 'excellent'} control for precise volleys and quick reactions. The low balance and round shape make it ${ratings.maneuverability >= 8 ? 'highly' : 'very'} responsive, allowing for fast exchanges and accurate placement.</p>\n`;
    html += `<p>While it may not have the raw power of more aggressive rackets, the control and precision make it excellent for players who rely on placement and consistency at the net.</p>\n\n`;
  } else {
    html += `<p>At the net, this racket offers a ${ratings.power >= 7 && ratings.control >= 7 ? 'balanced' : 'versatile'} performance. The design provides ${ratings.power >= 7 ? 'good' : 'adequate'} power for finishing points while maintaining ${ratings.control >= 7 ? 'excellent' : 'good'} control for precise volleys.</p>\n`;
    html += `<p>The ${ratings.maneuverability >= 7 ? 'good' : 'moderate'} maneuverability allows for quick reactions and fast exchanges, making it suitable for various net play styles.</p>\n\n`;
  }

  html += '<h3>On Smash</h3>\n';
  if (isDiamond && isHighBalance) {
    html += `<p>This is where the racket truly excels. With ${ratings.power >= 8.5 ? 'exceptional' : 'impressive'} energy transfer, it enables ${ratings.power >= 8.5 ? 'devastating' : 'powerful'} smashes and overheads, helping to finish off points with ${ratings.power >= 8.5 ? 'flair and ease' : 'authority'}. The combination of the diamond shape, high balance, and carbon fiber construction creates ${ratings.power >= 8.5 ? 'explosive' : 'impressive'} power on smashes.</p>\n`;
    html += `<p>Advanced players will find the power ${ratings.power >= 8.5 ? 'unmatched' : 'impressive'}, allowing them to end points quickly and decisively. The racket rewards aggressive play with ${ratings.power >= 8.5 ? 'devastating' : 'powerful'} results.</p>\n`;
  } else if (isRound && isLowBalance) {
    html += `<p>On smashes, this racket provides ${ratings.control >= 8 ? 'excellent' : 'good'} control and placement rather than raw power. While it may not generate the same explosive power as more aggressive rackets, the ${ratings.control >= 8 ? 'precision' : 'accuracy'} allows for well-placed smashes that are difficult to return.</p>\n`;
    html += `<p>The ${ratings.maneuverability >= 8 ? 'excellent' : 'good'} maneuverability makes it easier to position for smashes, and the control ensures you can place the ball exactly where you want it.</p>\n`;
  } else {
    html += `<p>On smashes, this racket offers a ${ratings.power >= 7.5 && ratings.control >= 7.5 ? 'balanced' : 'versatile'} approach. It provides ${ratings.power >= 7.5 ? 'good' : 'adequate'} power for effective smashes while maintaining ${ratings.control >= 7.5 ? 'excellent' : 'good'} control for placement.</p>\n`;
    html += `<p>The design allows for ${ratings.power >= 7.5 ? 'powerful' : 'effective'} finishing shots while still giving you the control needed to place the ball accurately.</p>\n`;
  }

  return html;
}

function generatePerformanceBreakdown(ratings) {
  let html = '<h2>Performance Breakdown</h2>\n\n';

  html += `<h3>Power (${ratings.power}/10)</h3>\n`;
  if (ratings.power >= 9) {
    html += '<p>Exceptional power generation. This racket is among the most powerful available, perfect for players who want to dominate with aggressive play and explosive shots.</p>\n\n';
  } else if (ratings.power >= 8) {
    html += '<p>Excellent power that allows for aggressive play and powerful shots. The racket generates impressive speed and penetration on attacking shots.</p>\n\n';
  } else if (ratings.power >= 7) {
    html += '<p>Good power that provides adequate speed and penetration. Suitable for players who want a balance between power and control.</p>\n\n';
  } else {
    html += '<p>Moderate power that prioritizes control and precision over raw speed. Ideal for players who focus on placement and consistency.</p>\n\n';
  }

  html += `<h3>Control (${ratings.control}/10)</h3>\n`;
  if (ratings.control >= 9) {
    html += '<p>Exceptional control that allows for precise placement and consistent shots. This racket excels in accuracy and placement.</p>\n\n';
  } else if (ratings.control >= 8) {
    html += '<p>Excellent control that provides confidence in placement and precision. The racket responds well to your intentions.</p>\n\n';
  } else if (ratings.control >= 7) {
    html += '<p>Good control that offers reliable placement and consistency. Suitable for players who want a balanced performance.</p>\n\n';
  } else {
    html += '<p>Moderate control that requires more technique to achieve precise placement. Better suited for experienced players.</p>\n\n';
  }

  html += `<h3>Rebound (${ratings.rebound}/10)</h3>\n`;
  if (ratings.rebound >= 8.5) {
    html += '<p>Excellent energy return and responsiveness. The racket transfers energy efficiently, providing powerful shots with good ball output.</p>\n\n';
  } else if (ratings.rebound >= 7.5) {
    html += '<p>Good rebound quality that provides solid energy transfer. The racket responds well to ball impact.</p>\n\n';
  } else {
    html += '<p>Moderate rebound that provides adequate energy return. The racket responds consistently to different shot types.</p>\n\n';
  }

  html += `<h3>Maneuverability (${ratings.maneuverability}/10)</h3>\n`;
  if (ratings.maneuverability >= 8.5) {
    html += '<p>Excellent maneuverability that allows for quick reactions and fast swings. The racket feels light and responsive in hand.</p>\n\n';
  } else if (ratings.maneuverability >= 7.5) {
    html += '<p>Good maneuverability that provides adequate speed and responsiveness. The racket handles well during fast exchanges.</p>\n\n';
  } else {
    html += '<p>Moderate maneuverability that requires more effort for quick movements. Better suited for players with good technique.</p>\n\n';
  }

  html += `<h3>Sweet Spot (${ratings.sweetSpot}/10)</h3>\n`;
  if (ratings.sweetSpot >= 8.5) {
    html += '<p>Large sweet spot that provides excellent forgiveness on off-center hits. This makes the racket more forgiving and easier to use.</p>\n\n';
  } else if (ratings.sweetSpot >= 7.5) {
    html += '<p>Good sweet spot size that offers adequate forgiveness. The racket is reasonably forgiving on off-center contact.</p>\n\n';
  } else {
    html += '<p>Moderate sweet spot that requires more precision and consistent contact. Better suited for players with developed technique.</p>\n\n';
  }

  return html;
}

function generateWhoItsFor(isAdvanced, isBeginner, isIntermediate, isDiamond, isRound, isTeardrop, ratings) {
  let html = '<h2>Who It\'s For</h2>\n';
  
  const skillLevel = isAdvanced ? 'advanced' : isBeginner ? 'beginner' : 'intermediate';
  const playStyle = isDiamond ? 'aggressive, power-focused' : isRound ? 'control-focused, precision-oriented' : 'versatile, balanced';
  
  html += `<p>The ${isDiamond ? 'power-oriented' : isRound ? 'control-focused' : 'balanced'} design makes this racket ideal for <strong>${skillLevel} players</strong> who:</p>\n`;
  html += '<ul>\n';
  
  if (isDiamond) {
    html += '<li>Prioritize power and aggressive play</li>\n';
    html += '<li>Have developed consistent technique</li>\n';
    html += '<li>Play at the net frequently</li>\n';
    html += '<li>Want maximum shot speed and penetration</li>\n';
    html += '<li>Are comfortable with a demanding racket</li>\n';
  } else if (isRound) {
    html += '<li>Prioritize control and precision</li>\n';
    html += '<li>Want a forgiving racket with a large sweet spot</li>\n';
    html += '<li>Focus on placement and consistency</li>\n';
    html += '<li>Prefer maneuverability over raw power</li>\n';
    html += '<li>Value comfort and reduced vibrations</li>\n';
  } else {
    html += '<li>Want a balanced performance</li>\n';
    html += '<li>Play a versatile game style</li>\n';
    html += '<li>Need flexibility in their shots</li>\n';
    html += '<li>Want good power and control</li>\n';
    html += '<li>Prefer an adaptable racket</li>\n';
  }
  
  html += '</ul>\n';
  
  if (isDiamond && ratings.control < 7) {
    html += '<p>This racket is <strong>not recommended</strong> for beginners or intermediate players who are still developing their technique. The smaller sweet spot and high balance require good timing and positioning to use effectively.</p>\n';
  } else if (isRound && ratings.power < 7) {
    html += '<p>This racket may <strong>not suit</strong> players who prioritize maximum power and aggressive play. While it offers excellent control, those seeking explosive power may want to consider more aggressive options.</p>\n';
  }
  
  return html;
}

function generateProsCons(isDiamond, isRound, isTeardrop, isHighBalance, isLowBalance, ratings, specs) {
  let html = '<h2>Pros & Cons</h2>\n';
  html += '<div class="pros-cons">\n';
  html += '<div class="pros">\n';
  html += '<h3>Pros</h3>\n';
  html += '<ul>\n';
  
  // Pros based on ratings and specs
  if (ratings.power >= 8) html += '<li>Exceptional power generation</li>\n';
  if (ratings.control >= 8) html += '<li>Excellent control and precision</li>\n';
  if (ratings.rebound >= 8) html += '<li>Great rebound and energy return</li>\n';
  if (ratings.maneuverability >= 8) html += '<li>Excellent maneuverability</li>\n';
  if (ratings.sweetSpot >= 8) html += '<li>Large, forgiving sweet spot</li>\n';
  if (specs.core && (specs.core.toLowerCase().includes('18k') || specs.core.toLowerCase().includes('24k'))) {
    html += '<li>Premium carbon fiber construction</li>\n';
  }
  if (specs.frame && specs.frame.toLowerCase().includes('oversize')) {
    html += '<li>Oversized frame for increased sweet spot</li>\n';
  }
  html += '<li>Quality build and materials</li>\n';
  html += '<li>Modern, attractive design</li>\n';
  
  html += '</ul>\n';
  html += '</div>\n';
  html += '<div class="cons">\n';
  html += '<h3>Cons</h3>\n';
  html += '<ul>\n';
  
  // Cons based on ratings and specs
  if (ratings.sweetSpot < 7 && isDiamond) html += '<li>Smaller sweet spot requires precision</li>\n';
  if (ratings.control < 7 && isDiamond) html += '<li>Demanding on technique</li>\n';
  if (ratings.maneuverability < 7 && isHighBalance) html += '<li>Lower maneuverability than lighter rackets</li>\n';
  if (ratings.power < 7 && isRound) html += '<li>Less power than more aggressive rackets</li>\n';
  if (isDiamond && ratings.control < 7.5) html += '<li>Not suitable for beginners</li>\n';
  if (ratings.sweetSpot < 7) html += '<li>Less forgiving on off-center hits</li>\n';
  if (ratings.maneuverability < 7) html += '<li>Requires more effort for quick movements</li>\n';
  
  html += '</ul>\n';
  html += '</div>\n';
  html += '</div>\n';
  
  return html;
}

function generateConclusion(name, brand, year, overallRating, isDiamond, isRound, isTeardrop) {
  const focus = isDiamond ? 'power-oriented' : isRound ? 'control-focused' : 'balanced';
  const quality = overallRating >= 8.5 ? 'excellent' : overallRating >= 7.5 ? 'strong' : 'solid';
  
  // Check if name already includes the year
  const nameWithYear = name.includes(year) ? name : `${name} ${year}`;
  
  let html = '<h2>Conclusion</h2>\n';
  html += `<p>In summary, the <strong>${brand} ${nameWithYear}</strong> stands out as a ${quality} choice in the ${focus} segment of the padel racket market. With an overall rating of ${overallRating}/10, it ${overallRating >= 8.5 ? 'delivers exceptional performance' : overallRating >= 7.5 ? 'offers strong performance' : 'provides solid value'} for ${isDiamond ? 'aggressive players' : isRound ? 'control-focused players' : 'versatile players'}.</p>\n`;
  
  if (isDiamond) {
    html += '<p>While it may require more from the player in terms of skill and technique, it is undeniably rewarding for those capable of wielding it with finesse. The combination of power, build quality, and design makes it one of the top choices for advanced players seeking maximum offensive capability.</p>\n';
  } else if (isRound) {
    html += '<p>The emphasis on control and precision makes it an excellent choice for players who prioritize placement and consistency. The forgiving nature and quality construction ensure reliable performance across different playing situations.</p>\n';
  } else {
    html += '<p>The balanced design makes it suitable for a wide range of players and playing styles. Whether you\'re looking for power, control, or a bit of both, this racket delivers consistent performance.</p>\n';
  }
  
  html += `<p><strong>Overall Rating: ${overallRating}/10</strong></p>\n`;
  
  return html;
}

/**
 * Generate review HTML page
 */
function generateReviewHTML(product, ratings, reviewContent) {
  const productId = product.id;
  const productName = product.name;
  const brand = product.brand;
  const year = product.year;
  const playerName = product.playerName || 'Professional Player';
  const price = product.price || 'N/A';
  const image = product.image || '/images/placeholders/product-placeholder.jpg';
  
  // Generate slug for filename
  const slug = productId;
  const reviewUrl = `/articles/reviews/${slug}-review.html`;
  
  // Determine subtitle and verdict
  const isDiamond = (product.specs?.shape || '').toLowerCase().includes('diamond') || (product.specs?.shape || '').toLowerCase().includes('power');
  const isRound = (product.specs?.shape || '').toLowerCase().includes('round');
  const focus = isDiamond ? 'Maximum Power' : isRound ? 'Superior Control' : 'Balanced Performance';
  const level = ratings.overall >= 8.5 ? 'Advanced Players' : ratings.overall >= 7.5 ? 'Intermediate to Advanced Players' : 'Intermediate Players';
  
  const subtitle = `${focus} for ${level}`;
  const verdict = `An ${ratings.overall >= 8.5 ? 'excellent' : ratings.overall >= 7.5 ? 'strong' : 'solid'} choice for ${ratings.overall >= 8.5 ? 'advanced' : ratings.overall >= 7.5 ? 'intermediate to advanced' : 'intermediate'} padel players, offering ${ratings.power >= 8 ? 'impressive power' : ratings.control >= 8 ? 'exceptional control' : 'balanced performance'}. ${isDiamond ? 'Ideal for aggressive players who dominate at the net.' : isRound ? 'Perfect for players who prioritize precision and placement.' : 'Suitable for versatile players seeking a balanced game.'}`;
  
  // Generate keywords
  const keywords = `${productName.toLowerCase()}, ${productName.toLowerCase()} review, ${brand.toLowerCase()} padel racket, padel racket review, best padel racket${year ? `, ${year} padel racket` : ''}`;
  
  // Generate description
  const description = `Comprehensive review of the ${productName} padel racket. Expert analysis of power (${ratings.power}/10), control (${ratings.control}/10), rebound (${ratings.rebound}/10), maneuverability (${ratings.maneuverability}/10), and sweet spot (${ratings.sweetSpot}/10) for ${ratings.overall >= 8.5 ? 'advanced' : ratings.overall >= 7.5 ? 'intermediate to advanced' : 'intermediate'} players.`;
  
  // Extract image filename
  let imageFilename = 'product-placeholder.jpg';
  if (image && image.includes('/')) {
    const imageParts = image.split('/');
    const lastPart = imageParts[imageParts.length - 1];
    if (lastPart) {
      imageFilename = slug + '.jpg';
    }
  }
  
  // Generate affiliate links
  const amazonLink = product.affiliateLinks?.amazon 
    ? `https://www.amazon.com/s?k=${encodeURIComponent(product.affiliateLinks.amazon)}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(productName + ' padel racket')}`;
  const padelNuestroLink = product.affiliateLinks?.padelNuestro
    ? `https://padelnuestro.com/search?q=${encodeURIComponent(product.affiliateLinks.padelNuestro)}`
    : `https://padelnuestro.com/search?q=${encodeURIComponent(slug)}`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta property="og:title" content="${productName} Review (${year}) - Expert Analysis">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <title>${productName} Review (${year}) - Expert Analysis | Padel Racket Review Hub</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${productName}",
    "description": "${isDiamond ? 'Advanced padel racket with maximum power' : isRound ? 'Control-focused padel racket with exceptional precision' : 'Balanced padel racket for versatile play'}",
    "brand": {
      "@type": "Brand",
      "name": "${brand}"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "${ratings.overall}",
      "reviewCount": "1"
    },
    "review": {
      "@type": "Review",
      "author": {
        "@type": "Organization",
        "name": "Padel Racket Review Hub"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "${ratings.overall}",
        "bestRating": "10"
      }
    }
  }
  </script>
</head>
<body>
  <div id="header-placeholder"></div>

  <main>
    <div id="hero-placeholder" 
         data-title="${productName} Review (${year})"
         data-subtitle="${subtitle}"
         data-verdict="${verdict}">
    </div>

    <div class="container">
      <div class="two-column">
        <div class="content-main">
          <img src="${image}" alt="${productName}" class="article-main-image" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
          <div class="article-header">
            <h1 class="article-product-name">${productName}</h1>
            <p class="article-product-year">${year} Edition</p>
          </div>
          
          <article class="article-content">
            ${reviewContent.intro ? (reviewContent.intro.startsWith('<p>') ? reviewContent.intro : `<p>${reviewContent.intro}</p>`) : `<p>${productName} is a ${brand} padel racket designed for ${ratings.overall >= 8.5 ? 'advanced' : ratings.overall >= 7.5 ? 'intermediate to advanced' : 'intermediate'} players.</p>`}

            ${reviewContent.technicalAnalysis}

            ${reviewContent.onTheCourt}

            ${reviewContent.performanceBreakdown}

            ${reviewContent.whoItsFor}

            ${reviewContent.prosCons}

            ${reviewContent.conclusion}
          </article>
          
          <!-- Purchase CTA -->
          <div class="purchase-cta">
            <div class="purchase-cta-content">
              <div class="purchase-cta-price">
                <span class="price-label">From</span>
                <span class="price-value">${price}</span>
              </div>
              <div class="purchase-cta-buttons">
                <a href="${amazonLink}" class="btn btn-amazon" target="_blank" rel="nofollow">Buy on Amazon</a>
                <a href="${padelNuestroLink}" class="btn btn-padel-nuestro" target="_blank" rel="nofollow">Buy on Padel Nuestro</a>
              </div>
            </div>
          </div>
          
          <!-- Similar Reviews Section -->
          <section class="similar-reviews">
            <h2 class="similar-reviews-title">Similar Rackets</h2>
            <div class="similar-reviews-grid">
              <!-- Similar rackets will be populated dynamically or manually -->
            </div>
          </section>
        </div>

        <div id="sidebar-placeholder" data-product-id="${productId}"></div>
      </div>
    </div>
  </main>

  <div id="footer-placeholder"></div>

  <script src="/js/config.js"></script>
  <script src="/js/templates.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>`;

  return { html, slug };
}

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse ChatGPT review content into structured format
 */
function parseChatGPTReview(chatGPTContent) {
  // Extract sections from ChatGPT HTML response
  const sections = {
    intro: '',
    technicalAnalysis: '',
    onTheCourt: '',
    performanceBreakdown: '',
    whoItsFor: '',
    prosCons: '',
    conclusion: ''
  };

  // Extract introduction (first paragraph before h2)
  const introMatch = chatGPTContent.match(/<p>([\s\S]*?)<\/p>/);
  if (introMatch) {
    sections.intro = introMatch[1];
  }

  // Extract Technical Analysis section
  const techMatch = chatGPTContent.match(/<h2>Technical Analysis<\/h2>([\s\S]*?)<h2>/);
  if (techMatch) {
    sections.technicalAnalysis = techMatch[1].trim();
  }

  // Extract On the Court section
  const courtMatch = chatGPTContent.match(/<h2>On the Court<\/h2>([\s\S]*?)<h2>Performance Breakdown<\/h2>/);
  if (courtMatch) {
    sections.onTheCourt = courtMatch[1].trim();
  }

  // Extract Performance Breakdown section
  const perfMatch = chatGPTContent.match(/<h2>Performance Breakdown<\/h2>([\s\S]*?)<h2>Who It's For<\/h2>/);
  if (perfMatch) {
    sections.performanceBreakdown = perfMatch[1].trim();
  }

  // Extract Who It's For section
  const whoMatch = chatGPTContent.match(/<h2>Who It's For<\/h2>([\s\S]*?)<h2>Pros & Cons<\/h2>/);
  if (whoMatch) {
    sections.whoItsFor = whoMatch[1].trim();
  }

  // Extract Pros & Cons section
  const prosMatch = chatGPTContent.match(/<h2>Pros & Cons<\/h2>([\s\S]*?)<h2>Conclusion<\/h2>/);
  if (prosMatch) {
    sections.prosCons = prosMatch[1].trim();
  }

  // Extract Conclusion section
  const conclMatch = chatGPTContent.match(/<h2>Conclusion<\/h2>([\s\S]*)/);
  if (conclMatch) {
    sections.conclusion = conclMatch[1].trim();
  }

  return sections;
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const useChatGPT = args['use-chatgpt'] || args.useChatGPT || process.env.USE_CHATGPT === 'true';
  const delay = parseInt(args.delay || process.env.CHATGPT_DELAY || '2000', 10); // Default 2 seconds between requests

  console.log('Starting review generation...\n');
  
  // Check if ChatGPT should be used
  let chatGPTAvailable = false;
  if (useChatGPT) {
    try {
      const apiKey = getApiKey();
      if (apiKey) {
        chatGPTAvailable = true;
        console.log('✓ ChatGPT API enabled - reviews will be generated using AI\n');
      } else {
        console.log('⚠ ChatGPT API key not found - falling back to algorithmic generation\n');
        console.log('   Set OPENAI_API_KEY environment variable or create config.json\n');
      }
    } catch (error) {
      console.log('⚠ ChatGPT API not available - falling back to algorithmic generation\n');
    }
  } else {
    console.log('Using algorithmic review generation (use --use-chatgpt to enable AI)\n');
  }

  // Load merged products
  let products = {};
  try {
    products = await fs.readJson(DEFAULT_MERGED);
    console.log(`Loaded ${Object.keys(products).length} products from merged-products.json`);
  } catch (error) {
    console.error('Failed to load merged products:', error.message);
    process.exit(1);
  }

  const stats = {
    processed: 0,
    ratingsUpdated: 0,
    reviewsCreated: 0,
    reviewsUpdated: 0,
    chatGPTGenerated: 0,
    errors: 0
  };

  // Process each product
  for (const [productId, product] of Object.entries(products)) {
    try {
      stats.processed++;
      
      // Calculate ratings if missing or null
      let ratings = product.ratings || {};
      const needsRatings = !ratings.power || !ratings.control || !ratings.rebound || 
                          !ratings.maneuverability || !ratings.sweetSpot || !ratings.overall;
      
      if (needsRatings) {
        ratings = calculateRatings(product);
        product.ratings = ratings;
        stats.ratingsUpdated++;
      } else {
        // Ensure ratings are numbers
        ratings = {
          power: typeof ratings.power === 'number' ? ratings.power : parseFloat(ratings.power) || 0,
          control: typeof ratings.control === 'number' ? ratings.control : parseFloat(ratings.control) || 0,
          rebound: typeof ratings.rebound === 'number' ? ratings.rebound : parseFloat(ratings.rebound) || 0,
          maneuverability: typeof ratings.maneuverability === 'number' ? ratings.maneuverability : parseFloat(ratings.maneuverability) || 0,
          sweetSpot: typeof ratings.sweetSpot === 'number' ? ratings.sweetSpot : parseFloat(ratings.sweetSpot) || 0,
          overall: typeof ratings.overall === 'number' ? ratings.overall : parseFloat(ratings.overall) || 0
        };
        product.ratings = ratings;
      }

      // Generate review content
      let reviewContent;
      if (chatGPTAvailable) {
        try {
          // Use ChatGPT to generate review
          const chatGPTResponse = await generateReviewWithChatGPT(product, ratings);
          const parsedContent = parseChatGPTReview(chatGPTResponse);
          
          // If parsing failed, use the raw content
          if (!parsedContent.intro && !parsedContent.technicalAnalysis) {
            // Fallback: use raw content as article body
            reviewContent = {
              intro: chatGPTResponse.match(/<p>([\s\S]*?)<\/p>/)?.[1] || '',
              technicalAnalysis: chatGPTResponse,
              onTheCourt: '',
              performanceBreakdown: '',
              whoItsFor: '',
              prosCons: '',
              conclusion: ''
            };
          } else {
            reviewContent = parsedContent;
          }
          
          stats.chatGPTGenerated++;
          
          // Rate limiting - wait between requests
          if (stats.processed < Object.keys(products).length) {
            await sleep(delay);
          }
        } catch (error) {
          console.error(`ChatGPT error for ${productId}, using fallback:`, error.message);
          // Fallback to algorithmic generation
          reviewContent = generateReviewContent(product, ratings);
        }
      } else {
        // Use algorithmic generation
        reviewContent = generateReviewContent(product, ratings);
      }
      
      // Generate review HTML
      const { html, slug } = generateReviewHTML(product, ratings, reviewContent);
      
      // Check if review file exists
      const reviewPath = path.resolve(REVIEWS_DIR, `${slug}-review.html`);
      const reviewExists = await fs.pathExists(reviewPath);
      
      // Write review file
      await fs.ensureDir(REVIEWS_DIR);
      await fs.writeFile(reviewPath, html, 'utf8');
      
      if (reviewExists) {
        stats.reviewsUpdated++;
      } else {
        stats.reviewsCreated++;
      }
      
      if (stats.processed % 50 === 0) {
        console.log(`Processed ${stats.processed} products... (${stats.chatGPTGenerated} via ChatGPT)`);
      }
    } catch (error) {
      console.error(`Error processing product ${productId}:`, error.message);
      stats.errors++;
    }
  }

  // Save updated products with ratings
  await fs.writeJson(DEFAULT_MERGED, products, { spaces: 2 });
  console.log(`\nUpdated merged-products.json with ratings`);

  // Print summary
  console.log('\n──────────── Review Generation Summary ────────────');
  console.log(`Products processed     : ${stats.processed}`);
  console.log(`Ratings updated        : ${stats.ratingsUpdated}`);
  console.log(`Reviews created        : ${stats.reviewsCreated}`);
  console.log(`Reviews updated       : ${stats.reviewsUpdated}`);
  if (chatGPTAvailable) {
    console.log(`ChatGPT generated      : ${stats.chatGPTGenerated}`);
  }
  console.log(`Errors                 : ${stats.errors}`);
  console.log('───────────────────────────────────────────────────\n');
  
  console.log('Next step: Update brand pages with new reviews and ratings.');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const [flag, inlineValue] = arg.split('=');
    const key = flag.replace(/^--/, '');

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

main().catch(error => {
  console.error('Failed to generate reviews:', error);
  process.exit(1);
});

