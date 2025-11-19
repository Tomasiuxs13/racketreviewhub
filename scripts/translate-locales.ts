import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isOpenAIConfigured,
  translateTextBatch,
  type TranslationBatchItem,
} from "../server/lib/openai.js";

type Locale = "es" | "pt" | "it" | "fr";

const DEFAULT_TARGET_LOCALES: Locale[] = ["es", "pt", "it", "fr"];
const MAX_KEYS_PER_BATCH = 25;
const MAX_CHARS_PER_BATCH = 1000;
const BASE_LOCALE = "en";
const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/src/locales",
);

interface FlatDictionary {
  [key: string]: string;
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const localesArg = getArgValue("--locales");

const targetLocales = localesArg
  ? localesArg
      .split(",")
      .map((locale) => locale.trim())
      .filter(isSupportedLocale)
  : DEFAULT_TARGET_LOCALES;

if (!targetLocales.length) {
  console.error("[i18n] No valid locales provided. Supported locales: es, pt, it, fr.");
  process.exit(1);
}

function isSupportedLocale(value: string): value is Locale {
  return (DEFAULT_TARGET_LOCALES as readonly string[]).includes(value);
}

function getArgValue(flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function flattenDictionary(
  value: unknown,
  prefix = "",
  result: FlatDictionary = {},
): FlatDictionary {
  if (typeof value === "string") {
    if (!prefix) {
      throw new Error("Encountered string at root level, which is not supported.");
    }
    result[prefix] = value;
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      flattenDictionary(item, nextPrefix, result);
    });
    return result;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenDictionary(child, nextPrefix, result);
    });
  }

  return result;
}

function applyTranslations(
  template: unknown,
  translations: FlatDictionary,
  prefix = "",
): unknown {
  if (typeof template === "string") {
    return translations[prefix] ?? template;
  }

  if (Array.isArray(template)) {
    return template.map((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      return applyTranslations(item, translations, nextPrefix);
    });
  }

  if (template && typeof template === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(template).forEach(([key, value]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      result[key] = applyTranslations(value, translations, nextPrefix);
    });
    return result;
  }

  return template;
}

function createBatches(keys: string[], englishFlat: FlatDictionary) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const key of keys) {
    const value = englishFlat[key];
    if (!value) continue;
    const entryLength = value.length;

    if (
      current.length >= MAX_KEYS_PER_BATCH ||
      currentChars + entryLength > MAX_CHARS_PER_BATCH
    ) {
      if (current.length) {
        batches.push(current);
      }
      current = [];
      currentChars = 0;
    }

    current.push(key);
    currentChars += entryLength;
  }

  if (current.length) {
    batches.push(current);
  }

  return batches;
}

async function safeReadJSON(filePath: string) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJSON(filePath: string, data: unknown) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, serialized, "utf8");
}

function shouldTranslateKey(
  key: string,
  englishValue: string,
  existingValue?: string,
) {
  if (!englishValue) return false;
  if (!existingValue) return true;
  const trimmedExisting = existingValue.trim();
  return trimmedExisting.length === 0 || trimmedExisting === englishValue.trim();
}

async function translateLocale(locale: Locale, englishTemplate: unknown) {
  const englishFlat = flattenDictionary(englishTemplate);
  const localePath = path.join(LOCALES_DIR, `${locale}.json`);
  const existingData = (await safeReadJSON(localePath)) ?? englishTemplate;
  const existingFlat = flattenDictionary(existingData);
  const targetFlat: FlatDictionary = { ...existingFlat };

  const keysNeedingTranslation = Object.entries(englishFlat)
    .filter(([key, value]) => shouldTranslateKey(key, value, existingFlat[key]))
    .map(([key]) => key);

  if (!keysNeedingTranslation.length) {
    console.log(`[i18n] Locale "${locale}" is already up to date.`);
    if (isDryRun) return;
    await writeJSON(localePath, existingData);
    return;
  }

  const batches = createBatches(keysNeedingTranslation, englishFlat);
  console.log(
    `[i18n] Translating ${keysNeedingTranslation.length} keys for "${locale}" across ${batches.length} batches.`,
  );

  for (const [batchIndex, batchKeys] of batches.entries()) {
    const payload: TranslationBatchItem[] = batchKeys.map((key) => ({
      key,
      text: englishFlat[key],
      context: `UI copy for ${key}`,
    }));

    if (isDryRun) {
      console.log(
        `[i18n][dry-run] Batch ${batchIndex + 1}/${batches.length} would translate ${batchKeys.length} keys.`,
      );
      continue;
    }

    try {
      const translations = await translateTextBatch(payload, locale);
      Object.entries(translations).forEach(([key, value]) => {
        if (value && value.trim().length > 0) {
          targetFlat[key] = value.trim();
        }
      });
    } catch (error) {
      console.error(`[i18n] Failed to translate batch ${batchIndex + 1}:`, error);
    }
  }

  if (isDryRun) {
    console.log(`[i18n][dry-run] Skipping write for "${locale}".`);
    return;
  }

  const nextData = applyTranslations(englishTemplate, targetFlat);
  await writeJSON(localePath, nextData);
  console.log(`[i18n] Wrote translations to ${path.relative(process.cwd(), localePath)}`);
}

async function ensureOpenAI() {
  if (isDryRun) {
    console.log("[i18n] Running in dry-run mode; OpenAI key not required.");
    return;
  }
  if (!isOpenAIConfigured) {
    throw new Error("OPENAI_API_KEY is not set. Unable to perform translations.");
  }
}

async function main() {
  await ensureOpenAI();

  const basePath = path.join(LOCALES_DIR, `${BASE_LOCALE}.json`);
  const englishTemplate = await safeReadJSON(basePath);
  if (!englishTemplate) {
    throw new Error(`Failed to read base locale file at ${basePath}`);
  }

  for (const locale of targetLocales) {
    await translateLocale(locale, englishTemplate);
  }
}

main().catch((error) => {
  console.error("[i18n] Translation script failed:", error);
  process.exitCode = 1;
});


