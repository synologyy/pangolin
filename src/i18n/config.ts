export type Locale = (typeof locales)[number];

export const locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'nl-NL', 'it-IT', 'pl-PL', 'pt-PT', 'tr-TR', 'zh-CN', 'nb-NO'] as const;
export const defaultLocale: Locale = 'en-US';