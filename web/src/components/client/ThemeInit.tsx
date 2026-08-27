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
      let t = localStorage.getItem('archia-theme');
      if (t !== 'light' && t !== 'dark' && t !== 'high-contrast') {
        t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.classList.remove('archia-dark', 'archia-light', 'archia-high-contrast');
      document.documentElement.classList.add('archia-' + t);
    } catch {
      document.documentElement.classList.add('archia-dark');
    }
  }, []);
  return null;
}
