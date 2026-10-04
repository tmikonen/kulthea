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
  /** Zoom-in steps from the whole map at which an event is shown on this map; 0 shows the whole map. */
  focusZoom: number;
}

/** A named place with a position, `[x, y]` in percent of the image, on each map it appears on. */
export interface LocationDef {
  id: string;
  name: LocalizedText;
  positions: Record<string, [number, number]>;
}

/** Where an event is shown on another map instead of the main one. */
export interface EventShowOn {
  map: string;
  /** The location id, or null for a one-off position. */
  location: string | null;
  position: [number, number];
}

/** An event as the app sees it. The date is the one in the file name; months are numbered from 1. */
export interface EventDef {
  /** The file name without `.md`. */
  id: string;
  year: number;
  month: number;
  day: number;
  order: number;
  title: LocalizedText;
  /** The text as HTML, in each language that has one. The default language always has it. */
  text: Record<string, string>;
  /** The main-map location id, or null for a one-off position or for no place (n/a). */
  location: string | null;
  /** The resolved main-map position, or null for n/a. */
  position: [number, number] | null;
  showOn: EventShowOn | null;
  /** Omitted in the file means the party (null here), `none` a standalone event, any other text a split group. */
  track: string | null;
  newSegment: boolean;
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
  locations: LocationDef[];
  events: EventDef[];
  ui: UiTexts;
}

/** What the app receives from `virtual:content`. */
export interface ContentBundle {
  campaign: Campaign;
  maps: ContentMap[];
  locations: LocationDef[];
  events: EventDef[];
  ui: UiTexts;
}
