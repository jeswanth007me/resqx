import { useState, useMemo, type ReactNode } from 'react';
import type { Locale } from './strings';
import { strings } from './strings';
import { LocaleContext } from './useLocale';

interface LocaleProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function LocaleProvider({ children, defaultLocale = 'en' }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const value = useMemo(
    () => ({ locale, setLocale, t: strings[locale] }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}
