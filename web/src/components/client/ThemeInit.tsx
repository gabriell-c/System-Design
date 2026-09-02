/*
  Component to initialize theme on client side.
  Runs only in the browser (useEffect) to avoid SSR ReferenceError.
*/
'use client';

import { useEffect } from 'react';

export default function ThemeInit() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      // Force dark theme always
      localStorage.setItem('archia-theme', 'dark');
      document.documentElement.classList.remove('archia-dark', 'archia-light', 'archia-high-contrast');
      document.documentElement.classList.add('archia-dark');
    } catch {
      document.documentElement.classList.add('archia-dark');
    }
  }, []);
  return null;
}
