/** The language named by the `lang` URL parameter; a missing or unknown value means the default. */
export function activeLanguage(languages: string[], defaultLanguage: string, param: string | null): string {
  return param !== null && languages.includes(param) ? param : defaultLanguage;
}
