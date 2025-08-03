'use server';

import {cookies, headers} from 'next/headers';
import {Locale, defaultLocale, locales} from '@/i18n/config';

// In this example the locale is read from a cookie. You could alternatively
// also read it from a database, backend service, or any other source.
const COOKIE_NAME = 'NEXT_LOCALE';

export async function getUserLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value;

  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const headerList = await headers(); 
  const acceptLang = headerList.get('accept-language');

  if (acceptLang) {
    const browserLang = acceptLang.split(',')[0];
    const matched = locales.find((locale) =>
      browserLang.toLowerCase().startsWith(locale.split('-')[0].toLowerCase())
    );
    if (matched) {
      return matched;
    }
  }

  return defaultLocale;
}


export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE_NAME, locale);
}
