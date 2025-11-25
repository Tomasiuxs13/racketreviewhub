import * as XLSX from "xlsx";
import type { ExcelRacket } from "@shared/schema";
import { excelRacketSchema } from "@shared/schema";
import { storage } from "../storage.js";
import { generateRacketReview, estimateRacketRatings } from "../lib/openai.js";

export interface UploadResults {
  created: number;
  updated: number;
  errors: string[];
  preview: ExcelRacket[];
  totalRows: number;
  processedRows: number;
}

export interface UploadProgressUpdate {
  totalRows?: number;
  processedRows?: number;
  created?: number;
  updated?: number;
  errors?: number;
  currentRow?: number;
  stage?: string;
  message?: string;
}

interface ProcessOptions {
  uploadId?: string;
  onProgress?: (update: UploadProgressUpdate) => void;
}

export async function processRacketUpload(
  fileBuffer: Buffer,
  originalName: string,
  options: ProcessOptions = {},
): Promise<UploadResults> {
  const uploadStartTime = Date.now();
  const uploadId =
    options.uploadId ?? `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const reportProgress = (update: UploadProgressUpdate) => {
    options.onProgress?.(update);
  };

  try {
    console.log(`[${uploadId}] Starting upload: ${originalName}, size: ${fileBuffer.length} bytes`);
    reportProgress({ stage: "parsing-file", message: "Parsing uploaded file" });

    const fileExt = originalName.toLowerCase().slice(originalName.lastIndexOf("."));
    let rawData: any[] = [];

    if (fileExt === ".numbers") {
      try {
        const { parseNumbersFile } = await import("../numbersParser.js");
        rawData = await parseNumbersFile(fileBuffer);
      } catch (numbersError) {
        console.error("Error parsing .numbers file:", numbersError);
        throw new Error(
          numbersError instanceof Error
            ? numbersError.message
            : "Failed to parse .numbers file. Please export as Excel (.xlsx) format.",
        );
      }
    } else {
      try {
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      } catch (excelError) {
        console.error("Error parsing Excel file:", excelError);
        throw new Error(
          excelError instanceof Error
            ? excelError.message
            : "Failed to parse Excel file. Please ensure the file is a valid .xlsx or .xls file.",
        );
      }
    }

    const results: UploadResults = {
      created: 0,
      updated: 0,
      errors: [],
      preview: [],
      totalRows: rawData.length,
      processedRows: 0,
    };

    reportProgress({
      totalRows: results.totalRows,
      stage: "processing-rows",
      message: "Processing rows",
    });

    if (rawData.length > 0) {
      const firstRow = rawData[0] as Record<string, unknown>;
      const foundColumns = Object.keys(firstRow);
      console.log("Found Excel columns:", foundColumns);
      console.log("Normalized columns:", foundColumns.map(normalizeKey));
    }

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as Record<string, any>;

      try {
        const hasAnyData = Object.values(row).some(
          (val) => val !== null && val !== undefined && val !== "",
        );
        if (!hasAnyData) {
          continue;
        }

        results.processedRows++;

        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          normalizedRow[normalizeKey(key)] = row[key];
        });

        if (i === 0) {
          console.log(
            "Available column names (normalized):",
            Object.keys(normalizedRow).join(", "),
          );
        }

        const getBrand = () => normalizedRow.brand || normalizedRow.brand_name || normalizedRow.marca;
        const getModel = () => normalizedRow.model || normalizedRow.model_name || normalizedRow.modelo;
        const getYear = () =>
          parseLocalizedNumber(normalizedRow.year || normalizedRow.ano || normalizedRow.year_released);
        const getShape = () =>
          normalizeShape(normalizedRow.shape || normalizedRow.forma || normalizedRow.shape_type);

        const getPower = () =>
          parseLocalizedNumber(
            normalizedRow.power_rating ||
              normalizedRow.powerrating ||
              normalizedRow.power ||
              normalizedRow.potencia ||
              normalizedRow.rating_power,
          );
        const getControl = () =>
          parseLocalizedNumber(
            normalizedRow.control_rating ||
              normalizedRow.controlrating ||
              normalizedRow.control ||
              normalizedRow.rating_control,
          );
        const getRebound = () =>
          parseLocalizedNumber(
            normalizedRow.rebound_rating ||
              normalizedRow.reboundrating ||
              normalizedRow.rebound ||
              normalizedRow.salida ||
              normalizedRow.rating_rebound,
          );
        const getManeuverability = () =>
          parseLocalizedNumber(
            normalizedRow.maneuverability_rating ||
              normalizedRow.maneuverabilityrating ||
              normalizedRow.maneuverability ||
              normalizedRow.maniobrabilidad ||
              normalizedRow.rating_maneuverability,
          );
        const getSweetSpot = () =>
          parseLocalizedNumber(
            normalizedRow.sweet_spot_rating ||
              normalizedRow.sweetspotrating ||
              normalizedRow.sweetspot ||
              normalizedRow.sweet_spot ||
              normalizedRow.punto_dulce ||
              normalizedRow.rating_sweetspot,
          );

        const getCurrentPrice = () =>
          parseLocalizedNumber(
            normalizedRow.current_price ||
              normalizedRow.currentprice ||
              normalizedRow.price ||
              normalizedRow.precio ||
              normalizedRow.precio_actual,
          );

        const getOriginalPrice = () => {
          const normalizedKeys = [
            "previous_price",
            "price1",
            "original_price",
            "originalprice",
            "precio_original",
            "rrp",
            "previousprice",
            "previous",
            "old_price",
            "oldprice",
            "old",
            "list_price",
            "listprice",
            "list",
            "msrp",
            "retail_price",
            "retailprice",
          ];

          for (const key of normalizedKeys) {
            const value = normalizedRow[key];
            if (value !== null && value !== undefined && value !== "") {
              const parsedValue = parseLocalizedNumber(value);
              if (parsedValue !== undefined && parsedValue !== null) {
                if (i === 0 || i < 3) {
                  console.log(
                    `✓ Found original/previous price in normalized key "${key}": "${value}" -> ${parsedValue}`,
                  );
                }
                return parsedValue;
              }
            }
          }

          if (i === 0) {
            console.log(
              "=== Searching for previous/original price column in original keys ===",
            );
            console.log("All row keys:", Object.keys(row));
            console.log("All normalized keys:", Object.keys(normalizedRow));
          }

          for (const key in row) {
            const lowerKey = key.toLowerCase().trim();
            const normalizedKey = normalizeKey(key);
            const rowValue = row[key];

            if (rowValue === null || rowValue === undefined || rowValue === "") {
              continue;
            }

            const matchesNormalizedKey = normalizedKeys.includes(normalizedKey);
            const isPriceColumn =
              lowerKey.includes("previous") ||
              lowerKey.includes("original") ||
              lowerKey.includes("old") ||
              lowerKey.includes("rrp") ||
              lowerKey.includes("list") ||
              lowerKey.includes("msrp") ||
              lowerKey.includes("retail") ||
              lowerKey.includes("before");

            const hasPriceTerm = lowerKey.includes("price") || lowerKey.includes("cost");

            if (lowerKey === "price1" || lowerKey === "price_1" || normalizedKey === "price1") {
              const foundValue = parseLocalizedNumber(rowValue);
              if (foundValue !== undefined && foundValue !== null) {
                console.log(
                  `✓ Found original/previous price in column "${key}" (Price1): "${rowValue}" -> ${foundValue}`,
                );
                return foundValue;
              }
            }

            if (
              matchesNormalizedKey ||
              (isPriceColumn && hasPriceTerm) ||
              (isPriceColumn && !lowerKey.includes("current"))
            ) {
              if (i === 0) {
                console.log(
                  `Checking column "${key}" (normalized: "${normalizedKey}"): value = "${rowValue}"`,
                );
              }

              const foundValue = parseLocalizedNumber(rowValue);
              if (foundValue !== undefined && foundValue !== null) {
                console.log(
                  `✓ Found original/previous price in column "${key}": "${rowValue}" -> ${foundValue}`,
                );
                return foundValue;
              } else if (rowValue !== null && rowValue !== undefined && rowValue !== "") {
                if (i === 0) {
                  console.log(
                    `✗ Column "${key}" has value "${rowValue}" but failed to parse as number`,
                  );
                }
              }
            }
          }

          if (i === 0) {
            console.log("=== No previous/original price found ===");
          }

          return undefined;
        };

        const getImageUrl = () =>
          normalizedRow.image_url || normalizedRow.imageurl || normalizedRow.image || normalizedRow.photo;
        const getAffiliateLink = () =>
          normalizedRow.affiliate_link ||
          normalizedRow.affiliatelink ||
          normalizedRow.link ||
          normalizedRow.url;
        const getTitleUrl = () =>
          normalizedRow.title_url || normalizedRow.titleurl || normalizedRow.title;
        const getReview = () =>
          normalizedRow.review_content ||
          normalizedRow.reviewcontent ||
          normalizedRow.review ||
          normalizedRow.description;

        const getColor = () => {
          const val = normalizedRow.color || normalizedRow.colour;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getBalance = () => {
          const val = normalizedRow.balance;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getSurface = () => {
          const val = normalizedRow.surface;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getHardness = () => {
          const val = normalizedRow.hardness;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getFinish = () => {
          const val = normalizedRow.finish;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getPlayersCollection = () => {
          const val =
            normalizedRow.players_collection ||
            normalizedRow.playerscollection ||
            normalizedRow.collection;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getProduct = () => {
          const val = normalizedRow.product;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getCore = () => {
          const val = normalizedRow.core;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getFormat = () => {
          const val = normalizedRow.format;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getGameLevel = () => {
          const val = normalizedRow.game_level || normalizedRow.gamelevel || normalizedRow.level;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getGameType = () => {
          const val = normalizedRow.game_type || normalizedRow.gametype;
          return val && String(val).trim() !== "" ? String(val).trim() : undefined;
        };
        const getPlayer = () => {
          const playerValue = normalizedRow.player || normalizedRow.gender;
          if (!playerValue) return undefined;
          const normalized = String(playerValue).toLowerCase().trim();
          if (normalized === "man" || normalized === "male" || normalized === "men") return "man";
          if (
            normalized === "woman" ||
            normalized === "female" ||
            normalized === "women" ||
            normalized === "lady"
          )
            return "woman";
          if (normalized === "both" || normalized === "unisex" || normalized === "all") return "both";
          return undefined;
        };

        const brand = getBrand();
        const model = getModel();

        const hasRatings = getPower() !== undefined || getControl() !== undefined;
        const estimatedRatings =
          !hasRatings && brand && model ? estimateRatingsByBrand(brand, model) : null;

        const titleUrl = getTitleUrl();
        const affiliateLink = getAffiliateLink() || titleUrl;

        const racketData: Record<string, any> = {
          brand,
          model: getModel(),
          year: getYear() || new Date().getFullYear(),
          shape: getShape(),
          powerRating: getPower() || estimatedRatings?.powerRating,
          controlRating: getControl() || estimatedRatings?.controlRating,
          reboundRating: getRebound() || estimatedRatings?.reboundRating,
          maneuverabilityRating: getManeuverability() || estimatedRatings?.maneuverabilityRating,
          sweetSpotRating: getSweetSpot() || estimatedRatings?.sweetSpotRating,
          currentPrice: getCurrentPrice(),
          originalPrice: getOriginalPrice(),
          imageUrl: getImageUrl(),
          affiliateLink: affiliateLink,
          titleUrl: titleUrl,
          reviewContent: getReview(),
          color: getColor(),
          balance: getBalance(),
          surface: getSurface(),
          hardness: getHardness(),
          finish: getFinish(),
          playersCollection: getPlayersCollection(),
          product: getProduct(),
          core: getCore(),
          format: getFormat(),
          gameLevel: getGameLevel(),
          gameType: getGameType(),
          player: getPlayer(),
        };

        const originalPrice = getOriginalPrice();
        const currentPrice = getCurrentPrice();
        console.log(
          `Row ${i + 2}: Processing racket - Brand: ${brand}, Model: ${getModel()}, Current Price: ${
            currentPrice || "not found"
          }, Original Price: ${originalPrice || "not found"}`,
        );
        console.log(
          `Row ${i + 2}: racketData.originalPrice before validation: ${racketData.originalPrice} (type: ${typeof racketData.originalPrice})`,
        );

        if (i === 0) {
          console.log("Price-related columns in first row:");
          Object.keys(row).forEach((key) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes("price") || lowerKey.includes("cost")) {
              console.log(`  - "${key}": ${row[key]} (normalized: ${normalizeKey(key)})`);
            }
          });
        }

        const validated = excelRacketSchema.parse(racketData);
        console.log(
          `Row ${i + 2}: validated.originalPrice after validation: ${validated.originalPrice} (type: ${typeof validated.originalPrice})`,
        );
        results.preview.push(validated);

        let existing = undefined;
        if (validated.titleUrl) {
          existing = await storage.getRacketByTitleUrl(validated.titleUrl);
        }
        if (!existing) {
          existing = await storage.getRacketByBrandAndModel(validated.brand, validated.model);
        }
        console.log(`Row ${i + 2}: ${existing ? "Found existing racket" : "Creating new racket"}`);

        if (existing) {
          const updateData: Record<string, any> = {
            currentPrice: validated.currentPrice.toString(),
          };

          if (validated.affiliateLink) {
            updateData.affiliateLink = validated.affiliateLink;
          }

          console.log(
            `Row ${i + 2}: Updating existing racket - only updating: ${Object.keys(updateData).join(
              ", ",
            )}`,
          );

          await storage.updateRacket(existing.id, updateData);
          results.updated++;
        } else {
          let ratings = {
            powerRating: validated.powerRating,
            controlRating: validated.controlRating,
            reboundRating: validated.reboundRating,
            maneuverabilityRating: validated.maneuverabilityRating,
            sweetSpotRating: validated.sweetSpotRating,
          };

          const hasRatingsFromExcel =
            validated.powerRating !== undefined && validated.controlRating !== undefined;

          if (!hasRatingsFromExcel) {
            console.log(
              `Row ${i + 2}: Estimating ratings with ChatGPT for ${validated.brand} ${validated.model}`,
            );
            try {
              const estimatedRatings = await estimateRacketRatings({
                brand: validated.brand,
                model: validated.model,
                shape: validated.shape,
                year: validated.year,
                balance: validated.balance,
                surface: validated.surface,
                hardness: validated.hardness,
                core: validated.core,
                gameLevel: validated.gameLevel,
                gameType: validated.gameType,
                player: validated.player,
              });

              if (estimatedRatings) {
                ratings = estimatedRatings;
                console.log(
                  `Row ${i + 2}: ChatGPT estimated ratings - Power: ${ratings.powerRating}, Control: ${ratings.controlRating}, Rebound: ${ratings.reboundRating}, Maneuverability: ${ratings.maneuverabilityRating}, Sweet Spot: ${ratings.sweetSpotRating}`,
                );
              } else {
                console.warn(
                  `Row ${i + 2}: ChatGPT rating estimation failed, using fallback estimates`,
                );
              }
            } catch (ratingError) {
              console.error(`Row ${i + 2}: Error estimating ratings:`, ratingError);
            }
          }

          const newRacket = await storage.createRacket({
            brand: validated.brand,
            model: validated.model,
            year: validated.year,
            shape: validated.shape,
            powerRating: ratings.powerRating,
            controlRating: ratings.controlRating,
            reboundRating: ratings.reboundRating,
            maneuverabilityRating: ratings.maneuverabilityRating,
            sweetSpotRating: ratings.sweetSpotRating,
            currentPrice: validated.currentPrice.toString(),
            originalPrice: validated.originalPrice?.toString(),
            imageUrl: validated.imageUrl || null,
            affiliateLink: validated.affiliateLink || null,
            titleUrl: validated.titleUrl || null,
            reviewContent: validated.reviewContent || null,
            color: validated.color || null,
            balance: validated.balance || null,
            surface: validated.surface || null,
            hardness: validated.hardness || null,
            finish: validated.finish || null,
            playersCollection: validated.playersCollection || null,
            product: validated.product || null,
            core: validated.core || null,
            format: validated.format || null,
            gameLevel: validated.gameLevel || null,
            gameType: validated.gameType || null,
            player: validated.player || null,
          });

          console.log(`Row ${i + 2}: Generating review for new racket ${newRacket.id}`);
          try {
            const reviewResult = await generateRacketReview(newRacket);
            if (reviewResult?.reviewContent) {
              console.log(
                `Row ${i + 2}: Review generated successfully (${reviewResult.reviewContent.length} chars)`,
              );
              await storage.updateRacket(newRacket.id, {
                reviewContent: reviewResult.reviewContent,
              });
            } else {
              console.warn(`Row ${i + 2}: Review generation returned no content`);
            }
          } catch (reviewError) {
            console.error(`Row ${i + 2}: Failed to generate review for new racket:`, reviewError);
            if (reviewError instanceof Error) {
              console.error(
                `Row ${i + 2}: Review error details:`,
                reviewError.message,
                reviewError.stack,
              );
            }
          }

          results.created++;
        }
      } catch (error) {
        if (error && typeof error === "object" && "issues" in error) {
          const zodError = error as any;
          const issues = zodError.issues
            .map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", ");
          results.errors.push(`Row ${i + 2}: ${issues}`);
        } else {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Row ${i + 2}: ${errorMessage}`);
        }
      }

      reportProgress({
        processedRows: results.processedRows,
        totalRows: results.totalRows,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
        currentRow: i + 2,
        stage: "processing-rows",
      });
    }

    const errorSummary: Record<string, number> = {};
    results.errors.forEach((error) => {
      if (error.includes("shape:"))
        errorSummary["Invalid shape value"] = (errorSummary["Invalid shape value"] || 0) + 1;
      else if (error.includes("currentPrice:"))
        errorSummary["Missing or invalid price"] =
          (errorSummary["Missing or invalid price"] || 0) + 1;
      else if (error.includes("brand:"))
        errorSummary["Missing brand"] = (errorSummary["Missing brand"] || 0) + 1;
      else if (error.includes("model:"))
        errorSummary["Missing model"] = (errorSummary["Missing model"] || 0) + 1;
      else errorSummary["Other errors"] = (errorSummary["Other errors"] || 0) + 1;
    });

    const uploadDuration = Date.now() - uploadStartTime;
    console.log(
      `[${uploadId}] Upload complete in ${(uploadDuration / 1000).toFixed(2)}s: ${
        results.processedRows
      }/${results.totalRows} rows processed, ${results.created} created, ${
        results.updated
      } updated, ${results.errors.length} errors`,
    );
    if (Object.keys(errorSummary).length > 0) {
      console.log(`[${uploadId}] Error summary:`, errorSummary);
    }
    if (results.errors.length > 0) {
      console.log(`[${uploadId}] Detailed errors:`, results.errors);
    }

    reportProgress({
      stage: "completed",
      processedRows: results.processedRows,
      totalRows: results.totalRows,
      created: results.created,
      updated: results.updated,
      errors: results.errors.length,
    });

    return results;
  } catch (error) {
    const uploadDuration = Date.now() - uploadStartTime;
    console.error(
      `[${uploadId}] Upload error after ${(uploadDuration / 1000).toFixed(2)}s:`,
      error,
    );
    if (error instanceof Error) {
      console.error(`[${uploadId}] Error stack:`, error.stack);
      reportProgress({ stage: "failed", message: error.message });
      throw error;
    }
    const err = new Error("Failed to process file");
    reportProgress({ stage: "failed", message: err.message });
    throw err;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function estimateRatingsByBrand(brand: string, model: string = "") {
  const brandLower = brand.toLowerCase();
  const seed = hashString(`${brandLower}-${model.toLowerCase()}`);

  const getOffset = (index: number, range: number) => {
    return hashString(`${seed}-${index}`) % range;
  };

  if (["nox", "bullpadel", "head"].includes(brandLower)) {
    return {
      powerRating: 85 + getOffset(1, 10),
      controlRating: 80 + getOffset(2, 10),
      reboundRating: 82 + getOffset(3, 10),
      maneuverabilityRating: 78 + getOffset(4, 10),
      sweetSpotRating: 80 + getOffset(5, 10),
    };
  }

  if (["babolat", "adidas", "wilson"].includes(brandLower)) {
    return {
      powerRating: 80 + getOffset(1, 10),
      controlRating: 82 + getOffset(2, 10),
      reboundRating: 78 + getOffset(3, 10),
      maneuverabilityRating: 80 + getOffset(4, 10),
      sweetSpotRating: 79 + getOffset(5, 10),
    };
  }

  if (["dunlop", "prince", "tecnifibre"].includes(brandLower)) {
    return {
      powerRating: 75 + getOffset(1, 10),
      controlRating: 77 + getOffset(2, 10),
      reboundRating: 74 + getOffset(3, 10),
      maneuverabilityRating: 76 + getOffset(4, 10),
      sweetSpotRating: 75 + getOffset(5, 10),
    };
  }

  return {
    powerRating: 70 + getOffset(1, 15),
    controlRating: 70 + getOffset(2, 15),
    reboundRating: 70 + getOffset(3, 15),
    maneuverabilityRating: 70 + getOffset(4, 15),
    sweetSpotRating: 70 + getOffset(5, 15),
  };
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function parseLocalizedNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;

  const str = String(value)
    .replace(/[€$£¥\s]/g, "")
    .replace(/,/g, ".")
    .trim();

  if (str === "") return undefined;
  const num = Number(str);
  return isNaN(num) ? undefined : num;
}

function normalizeShape(value: any): string {
  if (!value) return "round";
  const normalized = String(value).toLowerCase().trim();
  if (
    normalized.includes("diamond") ||
    normalized.includes("diamante") ||
    normalized.includes("diaman")
  )
    return "diamond";
  if (
    normalized.includes("round") ||
    normalized.includes("redonda") ||
    normalized.includes("circular")
  )
    return "round";
  if (
    normalized.includes("teardrop") ||
    normalized.includes("tear") ||
    normalized.includes("lágrima") ||
    normalized.includes("hybrid")
  )
    return "teardrop";
  return "round";
}

