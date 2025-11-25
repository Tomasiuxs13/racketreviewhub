#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const BEST_LISTS_DIR = path.resolve(ROOT_DIR, 'articles/best-lists');
const DEFAULT_MERGED = path.resolve(DATA_DIR, 'merged-products.json');

// Brand mapping
const BRAND_MAPPING = {
  'Bullpadel': 'bullpadel',
  'Head': 'head',
  'Adidas': 'adidas',
  'Nox': 'nox',
  'Siux': 'siux',
  'Wilson': 'wilson'
};

/**
 * Generate brand page HTML
 */
function generateBrandPage(brandName, products) {
  const brandSlug = BRAND_MAPPING[brandName] || brandName.toLowerCase();
  const year = new Date().getFullYear();
  
  // Sort products by overall rating (descending)
  const sortedProducts = products
    .filter(p => p.ratings && typeof p.ratings.overall === 'number' && p.ratings.overall > 0)
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
  
  // Generate product cards HTML
  let productsHTML = '';
  sortedProducts.forEach((product, index) => {
    const rating = product.ratings.overall.toFixed(1);
    const reviewUrl = `/articles/reviews/${product.id}-review.html`;
    const image = product.image || '/images/placeholders/product-placeholder.jpg';
    const price = product.price || 'N/A';
    const playerName = product.playerName || 'Professional Player';
    
    // Determine best for description
    const isDiamond = (product.specs?.shape || '').toLowerCase().includes('diamond') || 
                     (product.specs?.shape || '').toLowerCase().includes('power');
    const isRound = (product.specs?.shape || '').toLowerCase().includes('round');
    const bestFor = isDiamond ? 'Power' : isRound ? 'Control' : 'Versatility';
    
    // Generate key features
    const features = [];
    if (product.specs?.shape) features.push(product.specs.shape + ' shape');
    if (product.specs?.weight) {
      const weightMatch = product.specs.weight.match(/(\d{3})/);
      if (weightMatch) features.push(weightMatch[1] + 'g weight');
    }
    if (product.specs?.balance) features.push(product.specs.balance + ' balance');
    if (product.specs?.core) features.push(product.specs.core + ' core');
    const keyFeatures = features.length > 0 ? features.join(', ') : 'Premium construction';
    
    // Generate description
    let description = '';
    if (product.verdict && product.verdict.length > 200) {
      description = product.verdict.substring(0, 200).trim() + '...';
    } else if (product.verdict) {
      description = product.verdict;
    } else {
      description = `The ${product.name} offers ${isDiamond ? 'exceptional power' : isRound ? 'superior control' : 'balanced performance'} for ${product.ratings.overall >= 8.5 ? 'advanced' : product.ratings.overall >= 7.5 ? 'intermediate to advanced' : 'intermediate'} players.`;
    }
    
    productsHTML += `
        <div class="product-card" style="margin-bottom: var(--spacing-xl);">
          <h3>${index + 1}. ${product.name} - Best for ${bestFor}</h3>
          <div style="display: grid; grid-template-columns: 200px 1fr; gap: var(--spacing-md); margin: var(--spacing-md) 0;">
            <img src="${image}" alt="${product.name}" onerror="this.src='/images/placeholders/product-placeholder.jpg'">
            <div>
              <p><strong>Rating: ${rating}/10</strong> | <strong>Price: ${price}</strong></p>
              <p>${description}</p>
              <p><strong>Best for:</strong> ${product.ratings.overall >= 8.5 ? 'Advanced' : product.ratings.overall >= 7.5 ? 'Intermediate to Advanced' : 'Intermediate'} players seeking ${isDiamond ? 'maximum power' : isRound ? 'superior control' : 'balanced performance'}</p>
              <p><strong>Key Features:</strong> ${keyFeatures}</p>
              <a href="${reviewUrl}" class="btn btn-secondary">Read Full Review</a>
            </div>
          </div>
        </div>`;
  });
  
  // Generate brand-specific content
  const brandContent = getBrandContent(brandName);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Discover the best ${brandName} rackets of ${year}. Expert-tested reviews of top ${brandName} rackets for all skill levels, from beginners to advanced players.">
  <meta name="keywords" content="best ${brandName.toLowerCase()} racket ${year}, top ${brandName.toLowerCase()} rackets, best ${brandName.toLowerCase()} racket, ${brandName.toLowerCase()} racket comparison">
  <meta property="og:title" content="Best ${brandName} Rackets of ${year} - Expert Reviews & Comparison">
  <meta property="og:description" content="Discover the best ${brandName} rackets of ${year}. Expert-tested reviews of top ${brandName} rackets for all skill levels, from beginners to advanced players.">
  <meta property="og:type" content="article">
  <title>Best ${brandName} Rackets of ${year} - Expert Reviews & Comparison | Padel Racket Review Hub</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Best ${brandName} Rackets of ${year}",
    "description": "Expert-tested reviews of the top ${brandName} rackets for ${year}",
    "author": {
      "@type": "Organization",
      "name": "Padel Racket Review Hub"
    }
  }
  </script>
</head>
<body>
  <div id="header-placeholder"></div>

  <main>
    <div id="hero-placeholder" 
         data-title="Best ${brandName} Rackets of ${year}"
         data-subtitle="Expert-Tested Reviews of the Top ${brandName} Rackets for Every Player"
         data-image="/images/placeholders/hero-placeholder.jpg"
         data-verdict="After extensive testing, we've selected the best ${brandName} rackets of ${year} across all categories, from beginner-friendly options to professional-grade power rackets.">
    </div>

    <div class="container">
      <article class="article-content">
        <h2>Introduction</h2>
        <p>${brandContent.introduction}</p>
        <p>Our team of experts has tested ${brandName} rackets across their entire range, evaluating each model based on power, control, comfort, design, and overall value. This comprehensive guide will help you find the perfect ${brandName} racket for your playing style and skill level.</p>

        <h2>Top ${brandName} Rackets of ${year}</h2>
${productsHTML}

        <h2>Why Choose ${brandName}?</h2>
        <p>${brandContent.whyChoose}</p>
        <ul>
${brandContent.features.map(f => `          <li><strong>${f.title}:</strong> ${f.description}</li>`).join('\n')}
        </ul>

        <h2>How We Test</h2>
        <p>Our testing process involves:</p>
        <ul>
          <li><strong>Court Testing:</strong> Each racket is tested over multiple sessions on different court surfaces</li>
          <li><strong>Performance Metrics:</strong> We evaluate power, control, comfort, and design on a 10-point scale</li>
          <li><strong>Player Feedback:</strong> Multiple players of different skill levels test each racket</li>
          <li><strong>Build Quality:</strong> We assess materials, construction, and durability</li>
          <li><strong>Value Analysis:</strong> We compare performance to price to determine overall value</li>
        </ul>

        <h2>Choosing the Right ${brandName} Racket</h2>
        <p>When selecting a ${brandName} racket, consider:</p>
        <ul>
          <li><strong>Skill Level:</strong> Beginners should choose forgiving rackets, while advanced players can handle more demanding options</li>
          <li><strong>Playing Style:</strong> Aggressive players may prefer power rackets, while control-focused players should look for round or teardrop shapes</li>
          <li><strong>Weight Preference:</strong> Lighter rackets offer more maneuverability, while heavier rackets provide more power</li>
          <li><strong>Budget:</strong> Set a budget and find the best racket within that range</li>
        </ul>
        <p>For more detailed guidance, check out our <a href="/articles/guides/buying-guide-beginners.html">Padel Racket Buying Guide</a>.</p>

        <h2>Conclusion</h2>
        <p>${brandContent.conclusion}</p>
        ${sortedProducts.length > 0 ? `<p>Our top pick, the ${sortedProducts[0].name}, offers ${sortedProducts[0].ratings.overall >= 8.5 ? 'exceptional' : sortedProducts[0].ratings.overall >= 7.5 ? 'strong' : 'solid'} performance for ${sortedProducts[0].ratings.overall >= 8.5 ? 'advanced' : sortedProducts[0].ratings.overall >= 7.5 ? 'intermediate to advanced' : 'intermediate'} players. However, the best racket for you depends on your specific needs, playing style, and skill level. Use this guide as a starting point, and don't hesitate to try multiple rackets if possible before making your final decision.</p>` : ''}
      </article>
    </div>
  </main>

  <div id="footer-placeholder"></div>

  <script src="/js/config.js"></script>
  <script src="/js/templates.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>`;

  return html;
}

function getBrandContent(brandName) {
  const content = {
    'Bullpadel': {
      introduction: 'Bullpadel is one of the most respected brands in padel, known for creating high-performance rackets used by professional players worldwide. With innovative technologies and premium materials, Bullpadel rackets offer exceptional quality and performance.',
      whyChoose: 'Bullpadel has established itself as a leader in padel racket innovation, offering:',
      features: [
        { title: 'Professional Heritage', description: 'Used by top professional players on the World Padel Tour' },
        { title: 'Innovative Technology', description: 'Cutting-edge materials and construction techniques' },
        { title: 'Quality Materials', description: 'Premium carbon fiber frames and advanced core technologies' },
        { title: 'Wide Range', description: 'Rackets for every skill level and playing style' }
      ],
      conclusion: 'Bullpadel offers some of the finest padel rackets available. Whether you\'re a beginner looking for your first racket or an advanced player seeking maximum performance, Bullpadel has options that will suit your needs.'
    },
    'Head': {
      introduction: 'Head is a renowned brand in racquet sports, bringing decades of innovation and expertise to padel. Known for their balanced performance and quality construction, Head rackets are trusted by players at all levels.',
      whyChoose: 'Head brings decades of racquet sports expertise to padel, offering:',
      features: [
        { title: 'Proven Technology', description: 'Years of innovation in racquet sports applied to padel' },
        { title: 'Balanced Performance', description: 'Rackets designed for versatility and all-around play' },
        { title: 'Quality Construction', description: 'Durable materials and excellent build quality' },
        { title: 'Professional Endorsements', description: 'Trusted by professional players worldwide' }
      ],
      conclusion: 'Head offers excellent padel rackets that combine proven technology with modern innovation. Whether you\'re a beginner looking for your first racket or an advanced player seeking maximum performance, Head has options that will suit your needs.'
    },
    'Adidas': {
      introduction: 'Adidas brings its world-renowned sports expertise to padel, creating rackets that combine performance, innovation, and style. Known for their professional-grade equipment, Adidas padel rackets are trusted by competitive players.',
      whyChoose: 'Adidas combines sports innovation with padel expertise, offering:',
      features: [
        { title: 'Sports Heritage', description: 'Decades of experience in professional sports equipment' },
        { title: 'Advanced Technology', description: 'Innovative materials and construction techniques' },
        { title: 'Professional Quality', description: 'Rackets designed for competitive play' },
        { title: 'Modern Design', description: 'Sleek aesthetics that match performance' }
      ],
      conclusion: 'Adidas offers high-quality padel rackets that combine performance and style. Whether you\'re a competitive player or looking for reliable equipment, Adidas has options to enhance your game.'
    },
    'Nox': {
      introduction: 'Nox is a leading Spanish brand specializing in padel equipment, known for their innovative designs and professional-grade rackets. Nox rackets are used by some of the world\'s top padel players.',
      whyChoose: 'Nox has built its reputation on padel-specific innovation, offering:',
      features: [
        { title: 'Padel Specialization', description: 'Focused exclusively on padel equipment and innovation' },
        { title: 'Professional Players', description: 'Endorsed by top professional padel players' },
        { title: 'Innovative Designs', description: 'Unique technologies and construction methods' },
        { title: 'Quality Craftsmanship', description: 'Attention to detail and premium materials' }
      ],
      conclusion: 'Nox offers exceptional padel rackets designed specifically for the sport. Whether you\'re a recreational player or competing at the highest level, Nox has rackets that will enhance your performance.'
    },
    'Siux': {
      introduction: 'Siux is a Spanish brand known for creating high-performance padel rackets with innovative technologies. Their rackets are designed for players who demand the best in power, control, and precision.',
      whyChoose: 'Siux focuses on performance and innovation, offering:',
      features: [
        { title: 'Performance Focus', description: 'Rackets designed for maximum performance' },
        { title: 'Innovative Technologies', description: 'Unique materials and construction techniques' },
        { title: 'Professional Endorsements', description: 'Used by professional padel players' },
        { title: 'Quality Materials', description: 'Premium carbon fiber and core technologies' }
      ],
      conclusion: 'Siux offers high-performance padel rackets for serious players. Whether you\'re looking for power, control, or a balanced approach, Siux has rackets designed to elevate your game.'
    },
    'Wilson': {
      introduction: 'Wilson brings its extensive racquet sports heritage to padel, combining proven technologies with padel-specific innovations. Known for quality and reliability, Wilson rackets offer consistent performance.',
      whyChoose: 'Wilson combines racquet sports expertise with padel innovation, offering:',
      features: [
        { title: 'Racquet Heritage', description: 'Decades of experience in racquet sports' },
        { title: 'Proven Technologies', description: 'Tested technologies adapted for padel' },
        { title: 'Reliable Performance', description: 'Consistent quality and durability' },
        { title: 'Quality Construction', description: 'Well-built rackets that last' }
      ],
      conclusion: 'Wilson offers reliable padel rackets that combine proven technologies with padel-specific features. Whether you\'re new to the sport or an experienced player, Wilson has rackets to suit your needs.'
    }
  };
  
  return content[brandName] || {
    introduction: `${brandName} is a respected brand in padel, offering quality rackets for players of all levels.`,
    whyChoose: `${brandName} offers quality padel rackets with:`,
    features: [
      { title: 'Quality Construction', description: 'Well-built rackets with durable materials' },
      { title: 'Performance Focus', description: 'Designed for optimal padel performance' },
      { title: 'Player Options', description: 'Rackets for different skill levels and playing styles' }
    ],
    conclusion: `${brandName} offers quality padel rackets for players seeking reliable performance and good value.`
  };
}

/**
 * Main function
 */
async function main() {
  console.log('Starting brand page updates...\n');

  // Load merged products
  let products = {};
  try {
    products = await fs.readJson(DEFAULT_MERGED);
    console.log(`Loaded ${Object.keys(products).length} products from merged-products.json`);
  } catch (error) {
    console.error('Failed to load merged products:', error.message);
    process.exit(1);
  }

  // Group products by brand
  const productsByBrand = {};
  for (const [productId, product] of Object.entries(products)) {
    const brand = product.brand || 'Unknown';
    if (!productsByBrand[brand]) {
      productsByBrand[brand] = [];
    }
    productsByBrand[brand].push(product);
  }

  const stats = {
    brandsProcessed: 0,
    pagesCreated: 0,
    pagesUpdated: 0,
    errors: 0
  };

  // Process each brand
  for (const [brandName, brandProducts] of Object.entries(productsByBrand)) {
    try {
      // Only process known brands
      if (!BRAND_MAPPING[brandName]) {
        continue;
      }

      stats.brandsProcessed++;
      
      // Generate brand page HTML
      const html = generateBrandPage(brandName, brandProducts);
      
      // Determine file path
      const brandSlug = BRAND_MAPPING[brandName];
      const filePath = path.resolve(BEST_LISTS_DIR, `best-padel-rackets-${brandSlug}.html`);
      
      // Check if file exists
      const exists = await fs.pathExists(filePath);
      
      // Write file
      await fs.ensureDir(BEST_LISTS_DIR);
      await fs.writeFile(filePath, html, 'utf8');
      
      if (exists) {
        stats.pagesUpdated++;
        console.log(`Updated brand page: ${brandName} (${brandProducts.length} products)`);
      } else {
        stats.pagesCreated++;
        console.log(`Created brand page: ${brandName} (${brandProducts.length} products)`);
      }
    } catch (error) {
      console.error(`Error processing brand ${brandName}:`, error.message);
      stats.errors++;
    }
  }

  // Print summary
  console.log('\n──────────── Brand Page Update Summary ────────────');
  console.log(`Brands processed      : ${stats.brandsProcessed}`);
  console.log(`Pages created          : ${stats.pagesCreated}`);
  console.log(`Pages updated          : ${stats.pagesUpdated}`);
  console.log(`Errors                 : ${stats.errors}`);
  console.log('───────────────────────────────────────────────────\n');
}

main().catch(error => {
  console.error('Failed to update brand pages:', error);
  process.exit(1);
});




