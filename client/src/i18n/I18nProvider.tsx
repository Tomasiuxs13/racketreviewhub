import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type MessageDictionary = Record<string, string | MessageDictionary>;

export interface TranslationVariables {
  [key: string]: string | number | undefined | null;
}

export interface I18nContextValue {
  locale: Locale;
  availableLocales: Locale[];
  setLocale: (nextLocale: Locale) => void;
  t: (key: string, vars?: TranslationVariables) => string;
  isLoading: boolean;
  isReady: boolean;
}

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

const DEFAULT_LOCALE: Locale = "en";
const LOCALE_STORAGE_KEY = "rrh_locale";

/**
 * Extract locale from a URL pathname prefix like /es/rackets/... → "es"
 * Returns null if no locale prefix found.
 */
function extractLocaleFromPath(pathname: string): Locale | null {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (!match) return null;
  const candidate = match[1] as Locale;
  return SUPPORTED_LOCALES.includes(candidate) && candidate !== DEFAULT_LOCALE
    ? candidate
    : null;
}

/**
 * Strip the locale prefix from a pathname, e.g. /es/rackets/foo → /rackets/foo
 */
function stripLocaleFromPath(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(\/|$)/, (_, sep) => sep || "/");
}

/**
 * Build a locale-prefixed pathname, e.g. /rackets/foo + "es" → /es/rackets/foo
 */
function buildLocalizedPath(pathname: string, locale: Locale): string {
  const stripped = stripLocaleFromPath(pathname);
  if (locale === DEFAULT_LOCALE) return stripped || "/";
  return `/${locale}${stripped.startsWith("/") ? stripped : "/" + stripped}`;
}

// Pre-import all locale files for Vite compatibility
const localeModules = {
  en: () => import("../locales/en.json"),
  es: () => import("../locales/es.json"),
  pt: () => import("../locales/pt.json"),
  it: () => import("../locales/it.json"),
  fr: () => import("../locales/fr.json"),
} as const;

const dictionaryCache: Partial<Record<Locale, MessageDictionary>> = {};

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

async function loadDictionary(locale: Locale): Promise<MessageDictionary> {
  if (dictionaryCache[locale]) {
    return dictionaryCache[locale]!;
  }

  try {
    const loader = localeModules[locale];
    if (!loader) {
      throw new Error(`No loader for locale "${locale}"`);
    }
    const module = await loader();
    const messages = module.default || module;
    dictionaryCache[locale] = messages;
    return messages;
  } catch (error) {
    console.warn(`[i18n] Failed to load locale "${locale}", falling back to ${DEFAULT_LOCALE}:`, error);
    if (locale === DEFAULT_LOCALE) {
      dictionaryCache[locale] = {};
      return {};
    }
    return loadDictionary(DEFAULT_LOCALE);
  }
}

function resolveKey(dictionary: MessageDictionary, key: string): string | undefined {
  const segments = key.split(".");
  let current: string | MessageDictionary | undefined = dictionary;

  for (const segment of segments) {
    if (!current || typeof current === "string") {
      break;
    }
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: TranslationVariables): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token) => {
    const value = vars[token];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

// Minimal loading screen to prevent flash of untranslated content
function I18nLoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <div className="text-slate-400 text-sm font-medium tracking-wide">Loading...</div>
      </div>
    </div>
  );
}

export function I18nProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<MessageDictionary>({});
  const [fallbackMessages, setFallbackMessages] = useState<MessageDictionary>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Priority 1: locale from URL path prefix, e.g. /es/rackets/...
    const pathLocale = extractLocaleFromPath(window.location.pathname);
    if (pathLocale) {
      setLocaleState(pathLocale);
      window.localStorage.setItem(LOCALE_STORAGE_KEY, pathLocale);
      return;
    }

    // Priority 2: legacy ?lang= query param (redirect to path-based URL)
    const params = new URLSearchParams(window.location.search);
    const paramLocale = params.get("lang");
    if (paramLocale && isSupportedLocale(paramLocale) && paramLocale !== DEFAULT_LOCALE) {
      // Redirect to the new path-based URL format
      const newPath = buildLocalizedPath(window.location.pathname, paramLocale as Locale);
      params.delete("lang");
      const search = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, "", `${newPath}${search}${window.location.hash}`);
      setLocaleState(paramLocale as Locale);
      window.localStorage.setItem(LOCALE_STORAGE_KEY, paramLocale);
      return;
    }

    // Priority 3: stored preference
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) {
      setLocaleState(stored as Locale);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function hydrate() {
      setIsLoading(true);
      try {
        const [requestedMessages, defaultMessages] = await Promise.all([
          loadDictionary(locale),
          loadDictionary(DEFAULT_LOCALE),
        ]);

        if (!isCurrent) return;

        setMessages(requestedMessages);
        setFallbackMessages(defaultMessages);
        setIsReady(true);
      } catch (error) {
        console.error("[i18n] Failed to load locale dictionary", error);
        if (!isCurrent) return;
        setMessages({});
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    hydrate();
    return () => {
      isCurrent = false;
    };
  }, [locale]);

  const changeLocale = useCallback((nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      // Navigate to the locale-prefixed URL so the new locale is in the path
      const currentPath = stripLocaleFromPath(window.location.pathname);
      const newPath = buildLocalizedPath(currentPath, nextLocale);
      // Keep existing search params (but remove legacy ?lang=)
      const params = new URLSearchParams(window.location.search);
      params.delete("lang");
      const search = params.toString() ? `?${params.toString()}` : "";
      window.location.href = `${newPath}${search}${window.location.hash}`;
    }
  }, [locale]);

  const translate = useCallback(
    (key: string, vars?: TranslationVariables) => {
      const value =
        resolveKey(messages, key) ??
        resolveKey(fallbackMessages, key) ??
        key;
      return interpolate(value, vars);
    },
    [messages, fallbackMessages],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      availableLocales: [...SUPPORTED_LOCALES],
      setLocale: changeLocale,
      t: translate,
      isLoading,
      isReady,
    }),
    [changeLocale, isLoading, isReady, locale, translate],
  );

  // Show loading screen until translations are ready to prevent FOUC
  if (!isReady) {
    return (
      <I18nContext.Provider value={value}>
        <I18nLoadingScreen />
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  fr: "Français",
};

export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  fr: "Français",
};


