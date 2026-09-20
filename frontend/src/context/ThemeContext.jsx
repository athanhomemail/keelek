import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const AVAILABLE_FONTS = [
  { id: 'sarabun', name: 'สารบรรณ', desc: 'มีหัว อ่านง่าย คมชัด สบายตา (แนะนำ)' },
  { id: 'ibm', name: 'IBM Plex', desc: 'โมเดิร์น สลิม โปร่ง ไม่หนาตัน' },
  { id: 'prompt', name: 'Prompt', desc: 'โมเดิร์น ไร้หัว ทรงเดิม' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('keelek_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {}
    return 'dark'; // Dark mode is default
  });

  const [font, setFontState] = useState(() => {
    try {
      const saved = localStorage.getItem('keelek_font');
      if (saved === 'sarabun' || saved === 'ibm' || saved === 'prompt') {
        return saved;
      }
    } catch (e) {}
    return 'sarabun'; // Default to Sarabun for maximum clarity & distinct look
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
      }
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('keelek_theme', theme);
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-font', font);
    try {
      localStorage.setItem('keelek_font', font);
    } catch (e) {}
  }, [font]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  const setFont = (newFont) => {
    if (AVAILABLE_FONTS.some((f) => f.id === newFont)) {
      setFontState(newFont);
    }
  };

  const cycleFont = () => {
    setFontState((prev) => {
      if (prev === 'sarabun') return 'ibm';
      if (prev === 'ibm') return 'prompt';
      return 'sarabun';
    });
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setTheme,
        font,
        setFont,
        cycleFont,
        AVAILABLE_FONTS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

