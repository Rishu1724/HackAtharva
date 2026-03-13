import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

const languageTags = Object.keys(resources);
const fallbackLanguage = 'en';

const detectBrowserLanguage = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language || (navigator.languages && navigator.languages[0]);
  }
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) {
      return locale;
    }
  }
  return null;
};

const preferredTag = detectBrowserLanguage();
const normalizedTag = preferredTag ? preferredTag.split('-')[0].toLowerCase() : undefined;
const languageTag = normalizedTag && languageTags.includes(normalizedTag)
  ? normalizedTag
  : fallbackLanguage;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    resources,
    lng: languageTag,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
