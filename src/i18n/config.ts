export type Locale = (typeof locales)[number];

export const locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'nl-NL', 'it-IT', 'pl-PL', 'pt-PT', 'tr-TR', 'zh-CN', 'ko-KR', 'bg-BG', 'cs-CZ', 'ru-RU'] as const;
export const defaultLocale: Locale = 'en-US';