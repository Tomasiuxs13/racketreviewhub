/**
 * CJ Affiliate SFTP Feed Sync Service
 * 
 * Handles SFTP connection to CJ affiliate program and downloads the product feed.
 */

import SftpClient from "ssh2-sftp-client";
import { parse } from "csv-parse/sync";
import AdmZip from "adm-zip";
import { cjFeedProductSchema, type CjFeedProduct } from "@shared/schema";

// Environment variable configuration
const CJ_SFTP_HOST = process.env.CJ_SFTP_HOST || "datatransfer.cj.com";
const CJ_SFTP_USERNAME = process.env.CJ_SFTP_USERNAME || "";
const CJ_SFTP_PASSWORD = process.env.CJ_SFTP_PASSWORD || "";
const CJ_SFTP_PORT = parseInt(process.env.CJ_SFTP_PORT || "22", 10);
// CJ Subscription ID (from your CJ account)
const CJ_SUBSCRIPTION_ID = process.env.CJ_SUBSCRIPTION_ID || "311284";
// Feed directory path: /outgoing/productcatalog/{subscription_id}/
const CJ_FEED_DIRECTORY = process.env.CJ_FEED_DIRECTORY || `/outgoing/productcatalog/${CJ_SUBSCRIPTION_ID}`;
// File pattern: Padel_Nuestro-shopping-<timestamp>.zip
const CJ_FEED_FILE_PATTERN = process.env.CJ_FEED_FILE_PATTERN || "Padel_Nuestro-shopping";

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  algorithms?: {
    serverHostKey?: string[];
    kex?: string[];
    cipher?: string[];
  };
}

export interface FeedDownloadResult {
  success: boolean;
  data?: string;
  error?: string;
  filename?: string;
}

export interface ParsedFeedResult {
  success: boolean;
  products?: CjFeedProduct[];
  totalProducts?: number;
  padelRackets?: number;
  error?: string;
}

/**
 * Get SFTP configuration from environment variables
 */
export function getSftpConfig(): SftpConfig {
  if (!CJ_SFTP_USERNAME || !CJ_SFTP_PASSWORD) {
    throw new Error("CJ SFTP credentials not configured. Set CJ_SFTP_USERNAME and CJ_SFTP_PASSWORD environment variables.");
  }

  return {
    host: CJ_SFTP_HOST,
    port: CJ_SFTP_PORT,
    username: CJ_SFTP_USERNAME,
    password: CJ_SFTP_PASSWORD,
    // Enable legacy algorithms for older SFTP servers like CJ
    algorithms: {
      serverHostKey: [
        'ssh-rsa',
        'ssh-dss',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'rsa-sha2-512',
        'rsa-sha2-256',
      ],
      kex: [
        'diffie-hellman-group1-sha1',
        'diffie-hellman-group14-sha1',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group16-sha512',
        'diffie-hellman-group18-sha512',
        'diffie-hellman-group-exchange-sha1',
        'diffie-hellman-group-exchange-sha256',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
      ],
      cipher: [
        'aes128-ctr',
        'aes192-ctr',
        'aes256-ctr',
        'aes128-gcm',
        'aes128-gcm@openssh.com',
        'aes256-gcm',
        'aes256-gcm@openssh.com',
        'aes256-cbc',
        'aes192-cbc',
        'aes128-cbc',
        '3des-cbc',
      ],
    },
  };
}

/**
 * List available files in the SFTP directory
 */
export async function listSftpFiles(remotePath: string = "/"): Promise<string[]> {
  const sftp = new SftpClient();
  const config = getSftpConfig();

  try {
    console.log(`[CJ-SFTP] Connecting to ${config.host}:${config.port}...`);
    await sftp.connect(config);
    console.log("[CJ-SFTP] Connected successfully");

    const fileList = await sftp.list(remotePath);
    const files = fileList.map(f => f.name);
    console.log(`[CJ-SFTP] Found ${files.length} files in ${remotePath}`);
    
    return files;
  } catch (error) {
    console.error("[CJ-SFTP] Error listing files:", error);
    throw error;
  } finally {
    await sftp.end();
  }
}

/**
 * Find the latest feed file in the CJ feed directory
 */
async function findLatestFeedFile(sftp: SftpClient): Promise<string | null> {
  try {
    // List files in the feed directory (e.g., /outgoing/productcatalog/311284)
    console.log(`[CJ-SFTP] Looking for feed files in: ${CJ_FEED_DIRECTORY}`);
    const files = await sftp.list(CJ_FEED_DIRECTORY);
    console.log(`[CJ-SFTP] Files found: ${files.map(f => f.name).join(", ")}`);

    // Filter for files matching our pattern (Padel_Nuestro-shopping-*.zip)
    const feedFiles = files
      .filter(f => f.name.startsWith(CJ_FEED_FILE_PATTERN) && f.name.endsWith(".zip"))
      .sort((a, b) => {
        // Sort by modification time, newest first
        return (b.modifyTime || 0) - (a.modifyTime || 0);
      });

    if (feedFiles.length === 0) {
      console.log(`[CJ-SFTP] No files matching pattern '${CJ_FEED_FILE_PATTERN}*.zip' found`);
      return null;
    }

    const latestFile = feedFiles[0];
    console.log(`[CJ-SFTP] Latest feed file: ${latestFile.name} (modified: ${new Date(latestFile.modifyTime || 0).toISOString()})`);
    return `${CJ_FEED_DIRECTORY}/${latestFile.name}`;
  } catch (error) {
    console.error("[CJ-SFTP] Error listing feed directory:", error);
    return null;
  }
}

/**
 * Extract CSV data from ZIP file
 */
function extractCsvFromZip(zipBuffer: Buffer): string | null {
  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    console.log(`[CJ-SFTP] ZIP contains ${zipEntries.length} entries: ${zipEntries.map(e => e.entryName).join(", ")}`);

    // Find CSV file in the ZIP
    const csvEntry = zipEntries.find(entry => 
      entry.entryName.endsWith(".csv") || entry.entryName.endsWith(".txt")
    );

    if (!csvEntry) {
      console.error("[CJ-SFTP] No CSV or TXT file found in ZIP");
      return null;
    }

    console.log(`[CJ-SFTP] Extracting: ${csvEntry.entryName}`);
    const csvData = zip.readAsText(csvEntry);
    console.log(`[CJ-SFTP] Extracted ${csvData.length} characters`);
    
    return csvData;
  } catch (error) {
    console.error("[CJ-SFTP] Error extracting ZIP:", error);
    return null;
  }
}

/**
 * Download the product feed file from CJ SFTP
 */
export async function downloadFeedFile(filename?: string): Promise<FeedDownloadResult> {
  const sftp = new SftpClient();
  const config = getSftpConfig();

  try {
    console.log(`[CJ-SFTP] Connecting to ${config.host}:${config.port}...`);
    await sftp.connect(config);
    console.log("[CJ-SFTP] Connected successfully");

    // Find the latest feed file if no specific filename provided
    let targetPath = filename;
    if (!targetPath) {
      targetPath = await findLatestFeedFile(sftp);
      if (!targetPath) {
        // List root directory to help debug
        try {
          const rootFiles = await sftp.list("/");
          console.log("[CJ-SFTP] Files in root directory:", rootFiles.map(f => f.name).join(", "));
        } catch (e) {
          console.log("[CJ-SFTP] Could not list root directory");
        }

        return {
          success: false,
          error: `No feed file found matching pattern '${CJ_FEED_FILE_PATTERN}*.zip' in ${CJ_FEED_DIRECTORY}`,
        };
      }
    }

    console.log(`[CJ-SFTP] Downloading: ${targetPath}`);
    const fileData = await sftp.get(targetPath) as Buffer;
    console.log(`[CJ-SFTP] Downloaded ${fileData.length} bytes`);

    // Check if it's a ZIP file
    let csvData: string;
    if (targetPath.endsWith(".zip")) {
      const extracted = extractCsvFromZip(fileData);
      if (!extracted) {
        return {
          success: false,
          error: "Failed to extract CSV from ZIP file",
        };
      }
      csvData = extracted;
    } else {
      // Plain text file
      csvData = fileData.toString("utf-8");
    }

    return {
      success: true,
      data: csvData,
      filename: targetPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown SFTP error";
    console.error("[CJ-SFTP] Error downloading feed:", error);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    await sftp.end();
  }
}

/**
 * Parse price from CJ feed format (e.g., "109.95 EUR")
 */
export function parseCjPrice(priceStr: string | undefined): number | undefined {
  if (!priceStr) return undefined;
  
  // Remove currency code and whitespace
  const cleaned = priceStr.replace(/[A-Z]{3}$/i, "").trim();
  const price = parseFloat(cleaned);
  
  return isNaN(price) ? undefined : price;
}

/**
 * Extract model name from title by removing brand prefix
 */
export function extractModelFromTitle(title: string, brand: string): string {
  // Remove brand from the beginning of the title (case insensitive)
  const brandRegex = new RegExp(`^${brand}\\s+`, "i");
  let model = title.replace(brandRegex, "").trim();
  
  // If model is empty or same as title, use title as model
  if (!model || model === title) {
    model = title;
  }
  
  return model;
}

/**
 * Parse the CSV feed data and extract Padel Racket products
 */
export function parseFeedData(csvData: string): ParsedFeedResult {
  try {
    console.log("[CJ-Feed] Parsing CSV data...");
    
    // Parse CSV with proper handling of quoted fields
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    console.log(`[CJ-Feed] Parsed ${records.length} total records`);

    // Filter for Padel Racket products only
    const padelRackets: CjFeedProduct[] = [];
    let validationErrors = 0;

    for (const record of records) {
      // Check if this is a Padel Racket
      if (record.PRODUCT_TYPE !== "Padel Racket") {
        continue;
      }

      try {
        // Validate the record against our schema
        const validated = cjFeedProductSchema.parse(record);
        padelRackets.push(validated);
      } catch (validationError) {
        validationErrors++;
        if (validationErrors <= 5) {
          console.warn(`[CJ-Feed] Validation error for product ${record.ID}:`, validationError);
        }
      }
    }

    console.log(`[CJ-Feed] Found ${padelRackets.length} Padel Racket products (${validationErrors} validation errors)`);

    return {
      success: true,
      products: padelRackets,
      totalProducts: records.length,
      padelRackets: padelRackets.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
    console.error("[CJ-Feed] Error parsing feed data:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Main function to download and parse the CJ feed
 */
export async function fetchAndParseCjFeed(): Promise<ParsedFeedResult> {
  // Download the feed file
  const downloadResult = await downloadFeedFile();
  
  if (!downloadResult.success || !downloadResult.data) {
    return {
      success: false,
      error: downloadResult.error || "Failed to download feed",
    };
  }

  // Parse the feed data
  return parseFeedData(downloadResult.data);
}

/**
 * Parse feed from local file (for testing or manual import)
 */
export function parseFeedFromFile(filePath: string): ParsedFeedResult {
  const fs = require("fs");
  
  try {
    const csvData = fs.readFileSync(filePath, "utf-8");
    return parseFeedData(csvData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown file error";
    return {
      success: false,
      error: `Failed to read file: ${errorMessage}`,
    };
  }
}

