import type { Campaign } from './types';
import { resolveText } from './text';

/** A date as in an event file name: the month is numbered from 1. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * The English ordinal suffix of a day number ("st", "nd", "rd" or "th"). Other languages write the
 * day with a full stop or nothing, so their suffix is empty.
 */
export function ordinalSuffix(lang: string, day: number): string {
  if (lang !== 'en') return '';
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Writes a date in the chosen language from the campaign's date format, for example
 * "K.A. 6050, Talven 37. päivä" or "TE 6050, 37th of Winter". `{month}` is the month's in-date form.
 */
export function formatDate(campaign: Campaign, lang: string, date: CalendarDate): string {
  const def = campaign.defaultLanguage;
  const values: Record<string, string> = {
    era: resolveText(campaign.era.abbreviation, lang, def),
    year: String(date.year),
    month: resolveText(campaign.months[date.month - 1].inDate, lang, def),
    day: String(date.day),
    ordinal: ordinalSuffix(lang, date.day),
  };
  return campaign.dateFormat[lang].replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}
