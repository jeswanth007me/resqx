import { createContext, useContext } from 'react';
import type { Locale, LocaleStrings } from './strings';
import { strings } from './strings';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: LocaleStrings;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: strings.en,
});

export const useLocale = (): LocaleContextValue => useContext(LocaleContext);
