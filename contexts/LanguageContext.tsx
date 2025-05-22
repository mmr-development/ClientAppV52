import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'da' | 'en';
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
}>({ language: 'da', setLanguage: () => {} });

export const LanguageProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('da');

  useEffect(() => {
    const fetchLanguage = async () => {
      const storedLang = await AsyncStorage.getItem('app_language');
      if (storedLang === 'da' || storedLang === 'en') {
        setLanguageState(storedLang);
      }
    };

    fetchLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('app_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);