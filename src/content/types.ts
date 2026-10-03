/** A short text: a plain value (default language only) or a language map. */
export type LocalizedText = string | Record<string, string>;

export interface Month {
  name: LocalizedText;
  inDate: LocalizedText;
}

export interface Campaign {
  title: LocalizedText;
  languages: string[];
  defaultLanguage: string;
  era: { name: LocalizedText; abbreviation: LocalizedText };
  months: Month[];
  daysPerMonth: number;
  dateFormat: Record<string, string>;
}

export interface MapDef {
  id: string;
  name: LocalizedText;
  image: string;
  width: number;
  height: number;
  main: boolean;
}

export interface ContentBundle {
  campaign: Campaign;
  maps: MapDef[];
}
