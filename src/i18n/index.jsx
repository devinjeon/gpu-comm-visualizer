import React, { createContext, useContext, useState, useCallback } from 'react';
import en from './en';
import ko from './ko';

const translations = { en, ko };

// Global accessor for non-React code (renderer, engine)
let _globalLang = 'en';
try {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang === 'ko' || urlLang === 'en') _globalLang = urlLang;
  else { const saved = localStorage.getItem('lang'); if (saved === 'ko') _globalLang = 'ko'; }
} catch (e) {}

export function getLang() { return _globalLang; }

export function tGlobal(key, params) {
  let str = translations[_globalLang]?.[key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split('{' + k + '}').join(String(v));
    }
  }
  return str;
}

// React context
const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(_globalLang);

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'ko' : 'en';
      _globalLang = next;
      try { localStorage.setItem('lang', next); } catch (e) {}
      return next;
    });
  }, []);

  const t = useCallback((key, params) => {
    let str = translations[lang]?.[key] || translations.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.split('{' + k + '}').join(String(v));
      }
    }
    return str;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
