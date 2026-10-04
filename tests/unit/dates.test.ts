import { describe, expect, it } from 'vitest';
import content from 'virtual:content';
import { formatDate, ordinalSuffix } from '../../src/content/dates';
import type { Campaign } from '../../src/content/types';

const campaign = content.campaign;

describe('English ordinals (B-9)', () => {
  const st = [1, 21, 31, 41, 51, 61];
  const nd = [2, 22, 32, 42, 52, 62];
  const rd = [3, 23, 33, 43, 53, 63];

  it.each(Array.from({ length: 70 }, (_, i) => i + 1))('FR-7 day %i has the right English ending', (day) => {
    const expected = st.includes(day) ? 'st' : nd.includes(day) ? 'nd' : rd.includes(day) ? 'rd' : 'th';
    expect(ordinalSuffix('en', day)).toBe(expected);
  });

  it('FR-7 the teens are all "th": 11th, 12th and 13th, not 11st, 12nd and 13rd', () => {
    expect([11, 12, 13].map((day) => `${day}${ordinalSuffix('en', day)}`)).toEqual(['11th', '12th', '13th']);
  });

  it('FR-7 the ending is empty in Finnish and in any other language', () => {
    for (let day = 1; day <= 70; day++) {
      expect(ordinalSuffix('fi', day)).toBe('');
      expect(ordinalSuffix('sv', day)).toBe('');
    }
  });
});

describe('date formatter (B-9)', () => {
  const on = (month: number, day: number, year = 6050) => ({ year, month, day });

  it('FR-7 writes the example dates from the requirements', () => {
    expect(formatDate(campaign, 'fi', on(1, 37))).toBe('K.A. 6050, Talven 37. päivä');
    expect(formatDate(campaign, 'en', on(1, 37))).toBe('TE 6050, 37th of Winter');
  });

  it.each([
    [1, 'Talven', 'Winter'],
    [2, 'Kevään', 'Spring'],
    [3, 'Kesän', 'Summer'],
    [4, 'Ruskan', 'Autumn'],
    [5, 'Martaan', 'Fall'],
  ])('FR-7 month %i is "%s" in Finnish and "%s" in English', (month, fi, en) => {
    expect(formatDate(campaign, 'fi', on(month, 9))).toBe(`K.A. 6050, ${fi} 9. päivä`);
    expect(formatDate(campaign, 'en', on(month, 9))).toBe(`TE 6050, 9th of ${en}`);
  });

  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [70, '70th'],
  ])('FR-7 day %i is written %s in English, and with a full stop in Finnish', (day, english) => {
    expect(formatDate(campaign, 'en', on(2, day))).toBe(`TE 6050, ${english} of Spring`);
    expect(formatDate(campaign, 'fi', on(2, day))).toBe(`K.A. 6050, Kevään ${day}. päivä`);
  });

  it('FR-7 the year is written as it is', () => {
    expect(formatDate(campaign, 'en', on(3, 5, 6052))).toBe('TE 6052, 5th of Summer');
    expect(formatDate(campaign, 'fi', on(3, 5, 12))).toBe('K.A. 12, Kesän 5. päivä');
  });

  it('FR-7 builds the date from the campaign settings, so another calendar format works', () => {
    const custom: Campaign = {
      ...campaign,
      era: { name: 'Era', abbreviation: 'E.' },
      months: [{ name: 'A', inDate: 'Aten' }, ...campaign.months.slice(1)],
      dateFormat: { fi: '{day}/{month}/{year} {era}', en: '{month} {day}{ordinal}, {year}' },
    };
    expect(formatDate(custom, 'fi', on(1, 4))).toBe('4/Aten/6050 E.');
    expect(formatDate(custom, 'en', on(1, 4))).toBe('Aten 4th, 6050');
  });

  it('FR-9 a month or era with no text in the language falls back to the default language', () => {
    const partial: Campaign = {
      ...campaign,
      era: { name: campaign.era.name, abbreviation: { fi: 'K.A.' } },
      months: [{ name: 'A', inDate: { fi: 'Talven' } }, ...campaign.months.slice(1)],
    };
    expect(formatDate(partial, 'en', on(1, 2))).toBe('K.A. 6050, 2nd of Talven');
  });

  it('FR-7 leaves a placeholder that it does not know as it is', () => {
    const odd: Campaign = { ...campaign, dateFormat: { fi: '{day}. {weekday}', en: '{day}' } };
    expect(formatDate(odd, 'fi', on(1, 3))).toBe('3. {weekday}');
  });
});
