import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { cleanupTempContent, editJson, FIXTURES, loadModified } from './content-helpers';

afterEach(cleanupTempContent);

/** A minimal PNG of the given size; compresses well, so a huge one stays small on disk. */
function writePng(file: string, width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
  const rows = Buffer.alloc((width + 1) * height);
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

describe('content loading (B-3)', () => {
  it('FR-1 loads the fixture content into a bundle', () => {
    const { bundle, errors, warnings } = loadContent(FIXTURES);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(bundle?.campaign.defaultLanguage).toBe('fi');
    expect(bundle?.campaign.languages).toEqual(['fi', 'en']);
    expect(bundle?.campaign.months).toHaveLength(5);
    expect(bundle?.ui).toEqual({ maps: { fi: 'Kartta', en: 'Map' }, language: { fi: 'Kieli', en: 'Language' } });
    expect(bundle?.maps).toEqual([
      { id: 'main-map', name: { fi: 'Pääkartta', en: 'Main Map' }, image: 'maps/main-map.png', width: 3000, height: 1500, main: true },
      { id: 'second-map', name: 'Second Map', image: 'maps/second-map.png', width: 120, height: 80, main: false },
    ]);
  });

  it('FR-1 the real demo content in content/ is valid', () => {
    const { errors, warnings } = loadContent(path.resolve(__dirname, '../../content'));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  describe('errors', () => {
    it('FR-1 rejects no main map and names the file', () => {
      const { errors, bundle } = loadModified((dir) =>
        editJson(dir, 'maps.json', (maps) => delete maps[0].main));
      expect(bundle).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/maps\.json: exactly one map must have "main": true, found 0/);
    });

    it('FR-9 rejects a missing ui.json and names the file', () => {
      const { errors, bundle } = loadModified((dir) => fs.rmSync(path.join(dir, 'ui.json')));
      expect(bundle).toBeNull();
      expect(errors).toEqual([expect.stringMatching(/ui\.json: file not found/)]);
    });

    it('FR-9 rejects a ui.json text with no default-language value', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'ui.json', (ui) => { ui.maps = { en: 'Map' }; }));
      expect(errors).toEqual([expect.stringMatching(/ui\.json: text "maps" has no text in the default language "fi"/)]);
    });

    it('FR-9 rejects a ui.json text that is neither a string nor a language map', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'ui.json', (ui) => { ui.maps = 5; }));
      expect(errors).toEqual([expect.stringMatching(/ui\.json: text "maps" must be a string or a language map/)]);
    });

    it('FR-9 accepts a ui.json text that is only in the default language', () => {
      const { errors, bundle } = loadModified((dir) =>
        editJson(dir, 'ui.json', (ui) => { ui.maps = { fi: 'Kartta' }; }));
      expect(errors).toEqual([]);
      expect(bundle?.ui.maps).toEqual({ fi: 'Kartta' });
    });

    it('FR-1 rejects two main maps', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'maps.json', (maps) => { maps[1].main = true; }));
      expect(errors[0]).toMatch(/maps\.json: exactly one map must have "main": true, found 2/);
    });

    it('FR-1 rejects a declared size that does not match the image', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'maps.json', (maps) => { maps[0].width = 999; }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/maps\.json: map "main-map": declared size 999 x 1500 does not match the image "maps\/main-map\.png" \(3000 x 1500\)/);
    });

    it('FR-1 rejects a missing image file', () => {
      const { errors } = loadModified((dir) => fs.rmSync(path.join(dir, 'maps/second-map.png')));
      expect(errors).toEqual([expect.stringMatching(/maps\.json: map "second-map": image file "maps\/second-map\.png" not found/)]);
    });

    it('FR-1 rejects an unreadable image', () => {
      const { errors } = loadModified((dir) => fs.writeFileSync(path.join(dir, 'maps/second-map.png'), 'not an image'));
      expect(errors).toEqual([expect.stringMatching(/map "second-map": image file .* is not a readable image/)]);
    });

    it('FR-1 rejects duplicate map ids', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'maps.json', (maps) => { maps[1].id = 'main-map'; }));
      expect(errors).toEqual([expect.stringMatching(/map "main-map": duplicate id/)]);
    });

    it('FR-9 rejects a map name with no default-language text', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'maps.json', (maps) => { maps[0].name = { en: 'Main Map' }; }));
      expect(errors).toEqual([expect.stringMatching(/map "main-map": "name" has no text in the default language "fi"/)]);
    });

    it('FR-9 rejects a default language that is not in the language list', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { c.defaultLanguage = 'sv'; }));
      expect(errors[0]).toMatch(/campaign\.json: "defaultLanguage" must be one of the configured languages \(fi, en\)/);
    });

    it('FR-9 rejects a language with no era name', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { delete c.era.name.en; }));
      expect(errors).toEqual([expect.stringMatching(/campaign\.json: language "en" has no era name/)]);
    });

    it('FR-9 rejects a language with no era abbreviation', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { delete c.era.abbreviation.fi; }));
      expect(errors).toEqual([expect.stringMatching(/language "fi" has no era abbreviation/)]);
    });

    it('FR-7 rejects a language with a missing month name', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { delete c.months[2].name.en; }));
      expect(errors).toEqual([expect.stringMatching(/language "en" has no name for month 3/)]);
    });

    it('FR-7 rejects a language with a missing in-date form', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { delete c.months[4].inDate.fi; }));
      expect(errors).toEqual([expect.stringMatching(/language "fi" has no in-date form for month 5/)]);
    });

    it('FR-7 rejects a language with no date format', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { delete c.dateFormat.en; }));
      expect(errors).toEqual([expect.stringMatching(/language "en" has no date format/)]);
    });

    it('FR-7 rejects anything other than five months', () => {
      const { errors } = loadModified((dir) =>
        editJson(dir, 'campaign.json', (c) => { c.months.pop(); }));
      expect(errors[0]).toMatch(/campaign\.json: "months" must have exactly 5 entries, found 4/);
    });

    it('rejects invalid JSON and names the file', () => {
      const { errors } = loadModified((dir) => fs.writeFileSync(path.join(dir, 'maps.json'), '[ nope'));
      expect(errors).toEqual([expect.stringMatching(/maps\.json: invalid JSON/)]);
    });

    it('rejects a missing content file', () => {
      const { errors } = loadModified((dir) => fs.rmSync(path.join(dir, 'campaign.json')));
      expect(errors).toEqual([expect.stringMatching(/campaign\.json: file not found/)]);
    });
  });

  describe('warnings', () => {
    it('FR-1 warns about a map over 5000 px wide, and the build continues', () => {
      const { bundle, errors, warnings } = loadModified((dir) => {
        writePng(path.join(dir, 'maps/second-map.png'), 5001, 10);
        editJson(dir, 'maps.json', (maps) => { maps[1].width = 5001; maps[1].height = 10; });
      });
      expect(errors).toEqual([]);
      expect(bundle).not.toBeNull();
      expect(warnings).toEqual([expect.stringMatching(/map "second-map": image .* is over 5000 px wide \(5001 px\)/)]);
    });

    it('FR-1 warns about a map over 10 MB, and the build continues', () => {
      const { bundle, errors, warnings } = loadModified((dir) => {
        const file = path.join(dir, 'maps/second-map.png');
        // Trailing bytes after the PNG end chunk are ignored by readers, so this stays a valid PNG.
        fs.appendFileSync(file, Buffer.alloc(10 * 1024 * 1024 + 1));
      });
      expect(errors).toEqual([]);
      expect(bundle).not.toBeNull();
      expect(warnings).toEqual([expect.stringMatching(/map "second-map": image .* is over 10 MB/)]);
    });

    it('FR-1 warns about a map that is not JPEG, PNG or WebP', () => {
      const gif = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'); // 1 x 1 GIF
      const { bundle, errors, warnings } = loadModified((dir) => {
        fs.writeFileSync(path.join(dir, 'maps/second-map.gif'), gif);
        editJson(dir, 'maps.json', (maps) => {
          maps[1].image = 'maps/second-map.gif';
          maps[1].width = 1;
          maps[1].height = 1;
        });
      });
      expect(errors).toEqual([]);
      expect(bundle).not.toBeNull();
      expect(warnings).toEqual([expect.stringMatching(/image "maps\/second-map\.gif" is gif, not JPEG, PNG or WebP/)]);
    });
  });
});
