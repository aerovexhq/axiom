import React, { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { SupportedLanguage, Translations, SUPPORTED_LANGUAGES } from "./types";
import { en } from "./locales/en";
import { tr } from "./locales/tr";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";

// Dynamic locale registry containing all supported languages
type LocaleMap = Record<SupportedLanguage, Translations>;

const locales: LocaleMap = {
  en,
  tr,
  de,
  es,
  fr,
  ja,
  zh,
};

// Global method to register translated locale bundles
export const registerLocale = (lang: SupportedLanguage, bundle: Translations) => {
  locales[lang] = bundle;
};

// Auto-detect browser language
const detectLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined" || !navigator.language) {
    return "en";
  }
  const code = navigator.language.slice(0, 2).toLowerCase();
  if (code === "tr") return "tr";
  if (code === "de") return "de";
  if (code === "es") return "es";
  if (code === "fr") return "fr";
  if (code === "ja") return "ja";
  if (code === "zh") return "zh";
  return "en";
};

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("axiom_language") as SupportedLanguage | null;
    if (saved && ["en", "tr", "de", "es", "fr", "ja", "zh"].includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return detectLanguage();
};

export type TFunction = ((path: string, params?: Record<string, string | number>) => string) & Translations;

export interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TFunction;
  languages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("axiom_language", lang);
    } catch {
      // Ignore storage errors
    }
  };

  const currentTranslations = useMemo(() => {
    return locales[language] || en;
  }, [language]);

  const t = useMemo<TFunction>(() => {
    const fn = (path: string, params?: Record<string, string | number>): string => {
      const parts = path.split(".");
      let current: any = currentTranslations;
      let fallback: any = en;

      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = current[part];
        } else {
          current = undefined;
        }

        if (fallback && typeof fallback === "object" && part in fallback) {
          fallback = fallback[part];
        } else {
          fallback = undefined;
        }
      }

      let result = typeof current === "string" ? current : typeof fallback === "string" ? fallback : path;

      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
        });
      }

      return result;
    };

    return Object.assign(fn, currentTranslations) as TFunction;
  }, [currentTranslations]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    languages: SUPPORTED_LANGUAGES,
  }), [language, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const fn = ((path: string) => path) as TFunction;
    Object.assign(fn, en);
    return {
      language: "en" as SupportedLanguage,
      setLanguage: () => {},
      t: fn,
      languages: SUPPORTED_LANGUAGES,
    };
  }
  return ctx;
};
