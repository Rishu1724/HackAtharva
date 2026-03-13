import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const STORAGE_KEY = 'smart-transport-language';

export const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
});

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(i18n.language || 'en');

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && stored !== language) {
          await i18n.changeLanguage(stored);
          setLanguage(stored);
        }
      } catch (error) {
        console.warn('Language load failed', error);
      }
    };

    loadLanguage();
  }, []);

  const changeLanguage = useCallback(async (nextLanguage) => {
    try {
      await i18n.changeLanguage(nextLanguage);
      setLanguage(nextLanguage);
      await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.warn('Language change failed', error);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage: changeLanguage,
    }),
    [language, changeLanguage]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}
