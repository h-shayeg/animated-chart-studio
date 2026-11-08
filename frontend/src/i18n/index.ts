import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from './en'
import { fa } from './fa'
import { xrdEn, xrdFa } from './xrd'

export type Language = 'fa' | 'en'

const STORAGE_KEY = 'acs-language'

export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fa' || saved === 'en') return saved
  } catch {
    // Storage can be unavailable (for example in private mode), so use the browser language.
  }
  return navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en'
}

export function applyLanguage(language: Language, persist = false): void {
  document.documentElement.lang = language
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr'
  if (!persist) return
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // The choice is simply not remembered.
  }
}

const initialLanguage = detectLanguage()
applyLanguage(initialLanguage)

void i18n.use(initReactI18next).init({
  resources: {
    fa: { translation: { ...fa, xrd: xrdFa } },
    en: { translation: { ...en, xrd: xrdEn } },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
