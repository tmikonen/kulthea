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

/** Interface texts by key, each a plain value (default language only) or a language map. */
export type UiTexts = Record<string, LocalizedText>;

/** A map as the app sees it: the validated definition plus the served URL of its image. */
export interface ContentMap extends MapDef {
  imageUrl: string;
}

/** What the content folder holds once it has been read and validated. */
export interface LoadedContent {
  campaign: Campaign;
  maps: MapDef[];
  ui: UiTexts;
}

/** What the app receives from `virtual:content`. */
export interface ContentBundle {
  campaign: Campaign;
  maps: ContentMap[];
  ui: UiTexts;
}
