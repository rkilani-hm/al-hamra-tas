import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  getDirection,
  type AppLanguage,
} from "@/i18n";

function readStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && (SUPPORTED_LANGUAGES as string[]).includes(stored)) {
    return stored as AppLanguage;
  }
  return "en";
}

export function useLanguage() {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLanguage>(
    () => (i18n.language as AppLanguage) || "en",
  );

  // Sync from localStorage on mount (client-only)
  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== i18n.language) {
      void i18n.changeLanguage(stored);
    }
    setLanguageState(stored);
  }, [i18n]);

  // Apply lang + dir to <html> whenever language changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = getDirection(language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      void i18n.changeLanguage(next);
      setLanguageState(next);
    },
    [i18n],
  );

  const toggle = useCallback(() => {
    setLanguage(language === "en" ? "ar" : "en");
  }, [language, setLanguage]);

  return {
    language,
    direction: getDirection(language),
    setLanguage,
    toggle,
  };
}
