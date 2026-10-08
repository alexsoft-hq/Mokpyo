import i18n from 'i18next';
import { initReactI18next, useTranslation as useReactTranslation } from 'react-i18next';
import { enUS, ko } from 'date-fns/locale';
import shared from './locales/en-shared.json';
import pages from './locales/en-pages.json';
import components from './locales/en-components.json';

export type Language = 'en' | 'ko';
export const LANGUAGE_STORAGE_KEY = 'mokpyo.language';

export function normalizeLanguage(language?: string | null): Language {
  return language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function initialLanguage(): Language {
  if (import.meta.env?.MODE === 'test') return 'ko';
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch { /* Storage may be disabled by the browser. */ }
  return normalizeLanguage(typeof navigator === 'undefined' ? 'en' : navigator.language);
}

// Korean source phrases are stable translation keys. Keep interpolated values
// separate from keys so user-authored goal content is never translated.
export const englishMessages: Record<string, string> = { ...pages, ...components, ...shared };
const koreanMessages = Object.fromEntries(Object.keys(englishMessages).map(key => [key, key]));

void i18n.use(initReactI18next).init({
  resources: { en: { translation: englishMessages }, ko: { translation: koreanMessages } },
  lng: initialLanguage(),
  fallbackLng: 'ko',
  supportedLngs: ['en', 'ko'],
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

function applyLanguage(language: string) {
  const supported = normalizeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = supported;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, supported); } catch { /* Optional persistence. */ }
}
applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options));
}

export function useTranslation() {
  const result = useReactTranslation();
  return { ...result, t, i18n };
}

export function setLanguage(language: Language) {
  return i18n.changeLanguage(language);
}

export function getLocale(): 'en-US' | 'ko-KR' {
  return normalizeLanguage(i18n.language) === 'ko' ? 'ko-KR' : 'en-US';
}

export function getDateLocale() {
  return normalizeLanguage(i18n.language) === 'ko' ? ko : enUS;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

export default i18n;
