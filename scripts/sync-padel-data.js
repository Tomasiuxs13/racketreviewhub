#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const xlsx = require('xlsx');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const DEFAULT_SOURCE = path.resolve(DATA_DIR, 'Padel Rackets - Online Shopping _ Pādel Nuestro.numbers');
const DEFAULT_PARSED = path.resolve(DATA_DIR, 'parsed-rackets.json');
const DEFAULT_MERGED = path.resolve(DATA_DIR, 'merged-products.json');
const YEAR_MAPPING_FILE = path.resolve(DATA_DIR, 'product-years.json');
const RATING_KEYS = ['power', 'control', 'rebound', 'maneuverability', 'sweetSpot', 'overall'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let sourceFile = path.resolve(args.source || DEFAULT_SOURCE);
  const parsedOutput = path.resolve(args.parsed || DEFAULT_PARSED);
  const mergedOutput = path.resolve(args.merged || DEFAULT_MERGED);
  const worksheetName = args.sheet;
  const dryRun = Boolean(args['dry-run'] || args.dryRun);

  await assertFileExists(sourceFile, 'Source file');

  const workbook = xlsx.readFile(sourceFile);
  const sheetName = worksheetName && workbook.SheetNames.includes(worksheetName)
    ? worksheetName
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('No worksheet found in the provided file.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    console.warn('The selected worksheet does not contain any rows. Nothing to do.');
    return;
  }

  const seenIds = new Set();
  const parsedProducts = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const product = transformRow(row, seenIds);
    if (!product) {
      skipped += 1;
      return;
    }
    parsedProducts.push(product);
  });

  parsedProducts.sort((a, b) => a.name.localeCompare(b.name));

  if (!dryRun) {
    await fs.ensureDir(path.dirname(parsedOutput));
    await fs.writeJson(parsedOutput, parsedProducts, { spaces: 2 });
  }

  const mergedProducts = await mergeWithExisting(parsedProducts, mergedOutput, dryRun);

  console.log('──────────── Product Sync Summary ────────────');
  console.log(`Source file        : ${sourceFile}`);
  console.log(`Worksheet          : ${sheetName}`);
  console.log(`Rows processed     : ${rows.length}`);
  console.log(`Products parsed    : ${parsedProducts.length}`);
  console.log(`Rows skipped       : ${skipped}`);
  console.log(`Existing products  : ${mergedProducts.stats.previousTotal}`);
  console.log(`Updated products   : ${mergedProducts.stats.updated}`);
  console.log(`New products       : ${mergedProducts.stats.created}`);
  console.log(`Removed products   : ${mergedProducts.stats.removed}`);
  console.log(`Current total      : ${mergedProducts.stats.currentTotal}`);
  console.log(`Parsed output      : ${parsedOutput}${dryRun ? ' (dry run)' : ''}`);
  console.log(`Merged output      : ${mergedOutput}${dryRun ? ' (dry run)' : ''}`);

  if (mergedProducts.stats.newIds.length && mergedProducts.stats.newIds.length <= 10) {
    console.log('New IDs            :', mergedProducts.stats.newIds.join(', '));
  } else if (mergedProducts.stats.newIds.length > 10) {
    console.log('New IDs (sample)   :', mergedProducts.stats.newIds.slice(0, 10).join(', '), '...');
  }

  if (dryRun) {
    console.log('\nDry run enabled – no files were modified.');
  }
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

function transformRow(row, seenIds) {
  // New column mapping: Model → product name
  let model = cleanText(row.Model || row.Title || row.Text || '');
  
  // Validate that we have a model name and it's not a URL
  if (!model || model.startsWith('http://') || model.startsWith('https://')) {
    // If Model is a URL, try to extract name from Title_URL
    const titleUrl = cleanText(row.Title_URL || '');
    if (titleUrl && (titleUrl.startsWith('http://') || titleUrl.startsWith('https://'))) {
      // Try to extract product name from URL slug
      const slug = extractPadelSlug(titleUrl);
      if (slug) {
        // Convert slug to readable name (replace hyphens with spaces, capitalize)
        model = slug.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        console.warn(`Warning: Model column was a URL. Extracted name from URL: ${model}`);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  const productName = model; // Use Model column for product name
  const brand = cleanText(row.Brand || row.Text4 || inferBrandFromTitle(productName));
  const productId = buildProductId(brand, productName, seenIds);
  const description = cleanText(row['Short description'] || row.Text1 || row.Description || '');
  const playerName = cleanText(row.Player || row.Text11 || '');

  // Handle duplicate Surface columns - Excel/Numbers auto-renames duplicates as Surface_1
  const surface1 = cleanText(row.Surface || row['Surface_1']);
  const surface2 = cleanText(row['Surface_1'] || row.Surface); // Second Surface column (if exists)

  const specs = {
    shape: cleanText(row.Shape || row.Text17),
    weight: extractSpecFromField(row.Description || row.Field, 'Weight'),
    balance: cleanText(row.Balance || row.Text6),
    touch: cleanText(row.Hardness || row.Text8),
    frame: cleanText(surface2 || row.Text7 || ''),
    faces: cleanText(surface1 || row.Text10 || ''),
    core: cleanText(row.Core || row.Text14),
    level: cleanText(row['Game level'] || row.Text16)
  };

  return {
    name: productName,
    brand,
    price: normalizePrice(row['Current price'] || row.Price || row.Text3),
    image: cleanText(row.Image_URL || row.Image),
    description,
    playerName,
    originalData: row,
    ratings: createEmptyRatings(),
    specs,
    id: productId
  };
}

async function mergeWithExisting(parsedProducts, mergedOutput, dryRun) {
  let existing = {};
  try {
    if (await fs.pathExists(mergedOutput)) {
      existing = await fs.readJson(mergedOutput);
    }
  } catch (error) {
    console.warn('Failed to read existing merged products. A new file will be created.', error.message);
  }

  // Load year mapping file
  let yearMapping = {};
  try {
    if (await fs.pathExists(YEAR_MAPPING_FILE)) {
      yearMapping = await fs.readJson(YEAR_MAPPING_FILE);
    }
  } catch (error) {
    console.warn('Year mapping file not found or invalid. Years will be inferred from data.', error.message);
  }

  // Create a set of product IDs from the source file
  const sourceProductIds = new Set(parsedProducts.map(p => p.id));
  
  // Start with only products that exist in the source file
  const merged = {};
  const stats = {
    previousTotal: Object.keys(existing).length,
    updated: 0,
    created: 0,
    removed: 0,
    currentTotal: 0,
    newIds: []
  };

  // Process products from source file
  parsedProducts.forEach(product => {
    const existingProduct = existing[product.id];
    const mergedProduct = buildMergedProduct(product, existingProduct, yearMapping);
    merged[product.id] = mergedProduct;

    if (existingProduct) {
      stats.updated += 1;
    } else {
      stats.created += 1;
      stats.newIds.push(product.id);
    }
  });

  // Count removed products (products in existing but not in source)
  Object.keys(existing).forEach(id => {
    if (!sourceProductIds.has(id)) {
      stats.removed += 1;
    }
  });

  stats.currentTotal = Object.keys(merged).length;

  const sortedEntries = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b));
  const sortedMerged = Object.fromEntries(sortedEntries);

  if (!dryRun) {
    await fs.ensureDir(path.dirname(mergedOutput));
    await fs.writeJson(mergedOutput, sortedMerged, { spaces: 2 });
  }

  return { data: sortedMerged, stats };
}

function buildMergedProduct(parsedProduct, existingProduct = {}, yearMapping = {}) {
  const row = parsedProduct.originalData || {};
  // Check year mapping file first, then existing product, then infer from data
  let year = yearMapping[parsedProduct.id] || existingProduct.year || inferYear(row, null);
  // If still no year, use current year as last resort (but this should be updated in mapping file)
  if (!year) {
    year = new Date().getFullYear().toString();
  }
  const playerName = parsedProduct.playerName || existingProduct.playerName || 'Professional Player';
  const image = parsedProduct.image || existingProduct.image || '';
  const price = parsedProduct.price || existingProduct.price || '';
  const specs = { ...(existingProduct.specs || {}), ...filterEmpty(parsedProduct.specs) };
  const verdict = buildVerdict(row, existingProduct.verdict, parsedProduct.description);
  const affiliateLinks = buildAffiliateLinks(row, parsedProduct, existingProduct.affiliateLinks);
  const ratings = mergeRatings(existingProduct.ratings, parsedProduct.ratings);

  return {
    id: parsedProduct.id,
    name: parsedProduct.name,
    year,
    brand: parsedProduct.brand || existingProduct.brand || '',
    playerName,
    price,
    image,
    ratings,
    specs,
    verdict,
    alternatives: existingProduct.alternatives || [],
    affiliateLinks
  };
}

function buildVerdict(row, existingVerdict, fallbackDescription) {
  // Try new column name first, then fall back to old ones
  const description = formatParagraphs(row.Description || row.Text20);
  if (description) return description;

  const fieldText = formatParagraphs(stripHtml(row.Field));
  if (fieldText) return fieldText;

  if (existingVerdict) return existingVerdict;
  if (fallbackDescription) return fallbackDescription;

  return 'No summary available at this time.';
}

function buildAffiliateLinks(row, parsedProduct, existingLinks = {}) {
  const padelSlug = extractPadelSlug(row.Title_URL) || existingLinks.padelNuestro || parsedProduct.id;
  const amazonQuery = existingLinks.amazon || buildAmazonQuery(padelSlug, parsedProduct.name);

  const links = { ...existingLinks };
  links.padelNuestro = padelSlug;
  links.amazon = amazonQuery;
  return links;
}

function mergeRatings(existingRatings, parsedRatings) {
  if (existingRatings && typeof existingRatings === 'object') {
    return existingRatings;
  }
  if (parsedRatings && typeof parsedRatings === 'object') {
    return parsedRatings;
  }
  return createEmptyRatings();
}

function createEmptyRatings() {
  return RATING_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function normalizePrice(value) {
  const text = cleanText(value);
  if (!text) return '';
  if (text.startsWith('€')) return text;
  if (/^\d/.test(text)) {
    return `€${text}`;
  }
  return text;
}

function cleanText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return value.toString();
  return String(value).trim();
}

function formatParagraphs(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function stripHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\&nbsp;/gi, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function extractSpecFromField(fieldValue, label) {
  if (!fieldValue || !label) return '';
  const plain = stripHtml(fieldValue).replace(/\.\s+/g, '\n');
  const regex = new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i');
  const match = plain.match(regex);
  if (match) {
    return match[1].trim();
  }
  return '';
}

function inferBrandFromTitle(title) {
  return cleanText(title).split(' ')[0] || 'Unknown';
}

function inferYear(row, fallbackYear) {
  // Try new column names first, then fall back to old ones
  const sources = [
    row.Model,           // New: Model column
    row['Short description'], // New: Short description
    row.Description,     // New: Description column
    row.Title,           // Old: Title (for backward compatibility)
    row.Text1,           // Old: Text1 (for backward compatibility)
    row.Text20,          // Old: Text20 (for backward compatibility)
    row.Keywords,        // Keywords might contain year
    fallbackYear
  ];

  for (const source of sources) {
    const text = cleanText(source);
    if (!text) continue;
    // Look for 4-digit years (2000-2099)
    const match = text.match(/(20\d{2})/);
    if (match) {
      const year = match[1];
      // Validate year is reasonable (2000-2099)
      const yearNum = parseInt(year, 10);
      if (yearNum >= 2000 && yearNum <= 2099) {
        return year;
      }
    }
  }

  // Only default to current year if no year found and no fallback provided
  if (fallbackYear) {
    return fallbackYear;
  }

  // Return null instead of current year to indicate year needs to be set manually
  return null;
}

function buildProductId(brand, title, seenIds) {
  const composed = `${brand || ''} ${title || ''}`.trim();
  let base = slugify(composed) || slugify(title) || slugify(brand) || 'product';

  if (!base) {
    base = 'product';
  }

  let unique = base;
  let counter = 2;

  while (seenIds.has(unique)) {
    unique = `${base}-${counter}`;
    counter += 1;
  }

  seenIds.add(unique);
  return unique;
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractPadelSlug(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.pop() || '';
  } catch (error) {
    return '';
  }
}

function buildAmazonQuery(padelSlug, productName) {
  if (padelSlug) {
    return `${padelSlug.replace(/-/g, '+')}+padel+racket`;
  }
  return `${slugify(productName).replace(/-/g, '+')}+padel+racket`;
}

function filterEmpty(specs = {}) {
  return Object.entries(specs).reduce((acc, [key, value]) => {
    acc[key] = cleanText(value);
    return acc;
  }, {});
}

async function assertFileExists(filePath, label) {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

main().then(() => {
  // After sync completes, optionally run review generation
  if (process.env.AUTO_GENERATE_REVIEWS === 'true') {
    console.log('\n──────────── Auto-generating Reviews ────────────');
    const { spawn } = require('child_process');
    const reviewScript = spawn('node', [path.resolve(__dirname, 'generate-reviews.js')], {
      stdio: 'inherit',
      shell: false
    });
    
    reviewScript.on('close', (code) => {
      if (code === 0) {
        console.log('\n✓ Reviews generated successfully');
      } else {
        console.log(`\n⚠ Review generation exited with code ${code}`);
      }
    });
  }
}).catch(error => {
  console.error('Failed to synchronize padel rackets:', error);
  process.exit(1);
});

