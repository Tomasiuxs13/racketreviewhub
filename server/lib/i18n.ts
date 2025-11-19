import * as schema from "@shared/schema";
import { contentTranslations } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const TRANSLATABLE_ENTITY_TYPES = [
  "racket",
  "guide",
  "blog_post",
  "brand",
  "racket_review",
] as const;

export type TranslatableEntityType = (typeof TRANSLATABLE_ENTITY_TYPES)[number];
export type TranslationFields = Record<string, string>;

const databaseUrl = process.env.DATABASE_URL;
const postgresClient = databaseUrl ? postgres(databaseUrl) : null;
const db: PostgresJsDatabase<typeof schema> | null = postgresClient
  ? drizzle(postgresClient, { schema })
  : null;

if (postgresClient) {
  process.on("exit", () => {
    postgresClient.end().catch((error) => {
      console.error("[i18n] Failed to close Postgres client:", error);
    });
  });
}

const inMemoryTranslations = new Map<string, Map<string, TranslationFields>>();

function memoryKey(entityType: TranslatableEntityType, entityId: string) {
  return `${entityType}:${entityId}`;
}

function getMemoryBucket(entityType: TranslatableEntityType, entityId: string) {
  const key = memoryKey(entityType, entityId);
  if (!inMemoryTranslations.has(key)) {
    inMemoryTranslations.set(key, new Map());
  }
  return inMemoryTranslations.get(key)!;
}

export function isValidEntityType(value: string): value is TranslatableEntityType {
  return TRANSLATABLE_ENTITY_TYPES.includes(value as TranslatableEntityType);
}

export async function fetchTranslation(
  entityType: TranslatableEntityType,
  entityId: string,
  locale: string,
): Promise<TranslationFields | null> {
  if (db) {
    const rows = await db
      .select()
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, entityType),
          eq(contentTranslations.entityId, entityId),
          eq(contentTranslations.locale, locale),
        ),
      )
      .limit(1);

    return rows[0]?.fields ?? null;
  }

  return getMemoryBucket(entityType, entityId).get(locale) ?? null;
}

export async function fetchTranslationsForEntity(
  entityType: TranslatableEntityType,
  entityId: string,
): Promise<Record<string, TranslationFields>> {
  if (db) {
    const rows = await db
      .select()
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, entityType),
          eq(contentTranslations.entityId, entityId),
        ),
      );

    return rows.reduce<Record<string, TranslationFields>>((acc, row) => {
      acc[row.locale] = row.fields;
      return acc;
    }, {});
  }

  const bucket = getMemoryBucket(entityType, entityId);
  const result: Record<string, TranslationFields> = {};
  bucket.forEach((value, locale) => {
    result[locale] = value;
  });
  return result;
}

export async function upsertTranslation(
  entityType: TranslatableEntityType,
  entityId: string,
  locale: string,
  fields: TranslationFields,
): Promise<void> {
  if (db) {
    await db
      .insert(contentTranslations)
      .values({
        entityType,
        entityId,
        locale,
        fields,
      })
      .onConflictDoUpdate({
        target: [
          contentTranslations.entityType,
          contentTranslations.entityId,
          contentTranslations.locale,
        ],
        set: {
          fields,
          updatedAt: new Date(),
        },
      });
    return;
  }

  getMemoryBucket(entityType, entityId).set(locale, fields);
}

export async function bulkFetchTranslations(
  entityType: TranslatableEntityType,
  locale: string,
  entityIds: string[],
): Promise<Map<string, TranslationFields>> {
  const result = new Map<string, TranslationFields>();
  if (!entityIds.length) {
    return result;
  }

  if (db) {
    const rows = await db
      .select()
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, entityType),
          eq(contentTranslations.locale, locale),
          inArray(contentTranslations.entityId, entityIds),
        ),
      );

    rows.forEach((row) => {
      result.set(row.entityId, row.fields);
    });
    return result;
  }

  entityIds.forEach((entityId) => {
    const translation = getMemoryBucket(entityType, entityId).get(locale);
    if (translation) {
      result.set(entityId, translation);
    }
  });

  return result;
}

export async function applyTranslationsToEntity<T extends { id: string }>(
  entity: T,
  entityType: TranslatableEntityType,
  locale: string,
  translatableFields: (keyof T)[],
): Promise<T> {
  if (!entity || locale === "en") {
    return entity;
  }

  const translation = await fetchTranslation(entityType, entity.id, locale);
  if (!translation) {
    return entity;
  }

  return mergeFields(entity, translation, translatableFields);
}

export async function applyTranslationsToEntities<T extends { id: string }>(
  entities: T[],
  entityType: TranslatableEntityType,
  locale: string,
  translatableFields: (keyof T)[],
): Promise<T[]> {
  if (!entities.length || locale === "en") {
    return entities;
  }

  try {
    const translations = await bulkFetchTranslations(
      entityType,
      locale,
      entities.map((item) => item.id),
    );

    return entities.map((entity) => {
      try {
        const translation = translations.get(entity.id);
        if (!translation) {
          return entity;
        }
        return mergeFields(entity, translation, translatableFields);
      } catch (error) {
        console.error(`[i18n] Error applying translation to entity ${entity.id}:`, error);
        // Return original entity if translation merge fails
        return entity;
      }
    });
  } catch (error) {
    console.error(`[i18n] Error fetching translations for ${entityType} (${locale}):`, error);
    // Return original entities if translation fetch fails
    return entities;
  }
}

function mergeFields<T extends { id: string }>(
  entity: T,
  translation: TranslationFields,
  fields: (keyof T)[],
): T {
  const clone = { ...entity };
  fields.forEach((field) => {
    const key = String(field);
    // Only replace if translation has a non-empty value
    if (translation[key] !== undefined && translation[key] !== null && translation[key] !== "") {
      (clone as Record<string, unknown>)[key] = translation[key];
    }
  });
  return clone;
}


