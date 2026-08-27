/*
  Component to register Service Worker on client side.
  Runs only in the browser (useEffect) to avoid SSR ReferenceError.
*/
'use client';

import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if ('serviceWorker' in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      };
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);
  return null;
}
