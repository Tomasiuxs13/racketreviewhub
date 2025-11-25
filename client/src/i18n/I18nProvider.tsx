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

    const params = new URLSearchParams(window.location.search);
    const paramLocale = params.get("lang");
    if (paramLocale && isSupportedLocale(paramLocale)) {
      setLocaleState(paramLocale);
      window.localStorage.setItem(LOCALE_STORAGE_KEY, paramLocale);
      return;
    }

    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const currentUrl = new URL(window.location.href);
    if (locale === DEFAULT_LOCALE) {
      if (currentUrl.searchParams.has("lang")) {
        currentUrl.searchParams.delete("lang");
        window.history.replaceState(
          {},
          "",
          `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
        );
      }
      return;
    }
    currentUrl.searchParams.set("lang", locale);
    window.history.replaceState(
      {},
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, [locale]);

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


