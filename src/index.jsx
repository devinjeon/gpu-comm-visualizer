import React from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider } from './i18n';
import App from './App';
import './App.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <LangProvider>
    <App />
  </LangProvider>
);
