import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ar from "./locales/ar.json";

export type AppLanguage = "en" | "ar";

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["en", "ar"];
export const LANGUAGE_STORAGE_KEY = "alhamra.lang";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function getDirection(lang: AppLanguage): "ltr" | "rtl" {
  return lang === "ar" ? "rtl" : "ltr";
}

export default i18n;
