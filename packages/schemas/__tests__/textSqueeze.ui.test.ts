// @vitest-environment jsdom

import type { Font as FontKitFont } from 'fontkit';
import { mm2pt, type Font } from '@pdfme/common';
import { uiRender } from '../src/text/uiRender.js';
import type { TextSchema } from '../src/text/types.js';

// Every glyph is half an em wide, so a line's width is characters × fontSize / 2.
const mockFont = {
  unitsPerEm: 1000,
  ascent: 800,
  descent: -200,
  bbox: { maxY: 800, minY: -200 },
  layout: (text: string) => ({ glyphs: Array.from(text, () => ({ advanceWidth: 500 })) }),
  hasGlyphForCodePoint: () => true,
} as unknown as FontKitFont;

const FONT_SIZE = 13;
const LONG = 'X'.repeat(60); // 390pt, in a 100mm (283.46pt) box
const RATIO = mm2pt(100) / ((LONG.length * FONT_SIZE) / 2);

const schema = (overrides: Partial<TextSchema> = {}): TextSchema => ({
  id: 'squeezed',
  name: 'label',
  type: 'text',
  content: '',
  position: { x: 0, y: 0 },
  width: 100,
  height: 20,
  alignment: 'center',
  verticalAlignment: 'top',
  fontName: 'Base',
  fontSize: FONT_SIZE,
  lineHeight: 1,
  characterSpacing: 0,
  fontColor: '#000000',
  backgroundColor: '',
  squeezeToFit: true,
  ...overrides,
});

const render = async (value: string, textSchema: TextSchema, mode: 'viewer' | 'form') => {
  const rootElement = document.createElement('div');
  await uiRender({
    value,
    schema: textSchema,
    rootElement,
    mode,
    onChange: () => undefined,
    options: { font: { Base: { data: new Uint8Array(), fallback: true } } as Font },
    _cache: new Map<string | number, unknown>([['getFontKitFont-Base', mockFont]]),
    theme: { colorPrimary: '#1677ff' },
  } as Parameters<typeof uiRender>[0]);
  return rootElement.querySelector(`#text-${textSchema.id}`) as HTMLDivElement;
};

const scaleOf = (transform: string) => Number(/scaleX\(([\d.]+)\)/.exec(transform)?.[1]);

describe('squeezeToFit in the UI', () => {
  it('scales each read-only line that is too wide, and only those', async () => {
    const textBlock = await render(`SHORT\n${LONG}`, schema({ readOnly: true }), 'viewer');
    const lines = Array.from(textBlock.querySelectorAll<HTMLElement>('[data-pdfme-wrap-line]'));

    expect(lines.map((line) => line.textContent)).toEqual(['SHORT', LONG]);
    expect(lines[0].style.transform).toBe('');
    expect(scaleOf(lines[1].style.transform)).toBeCloseTo(RATIO, 4);
    expect(lines[1].style.transformOrigin).toBe('left');
  });

  it('keeps editable text on its lines and narrows the block by its widest line', async () => {
    const textBlock = await render(LONG, schema(), 'form');

    expect(textBlock.style.whiteSpace).toBe('pre');
    expect(scaleOf(textBlock.style.transform)).toBeCloseTo(RATIO, 4);
    expect(parseFloat(textBlock.style.width)).toBeCloseTo(100 / RATIO, 2);
  });

  it('leaves text alone without the option', async () => {
    const textBlock = await render(LONG, schema({ squeezeToFit: undefined }), 'form');

    expect(textBlock.style.whiteSpace).toBe('pre-wrap');
    expect(textBlock.style.transform).toBe('');
  });
});
