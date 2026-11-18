import * as fontkit from 'fontkit';
import * as pdfLib from '@pdfme/pdf-lib';
import { getDefaultFont, mm2pt } from '@pdfme/common';
import { vi } from 'vitest';
import {
  getFontKitFont,
  getSqueezeRatio,
  getWrapWidthInPt,
  widthOfTextAtSize,
} from '../src/text/helper.js';
import { getDynamicLayoutForText } from '../src/text/dynamicTemplate.js';
import { pdfRender } from '../src/text/pdfRender.js';
import type { TextSchema } from '../src/text/types.js';

const FONT = getDefaultFont();
const BASE_PDF = {
  width: 210,
  height: 297,
  padding: [0, 0, 0, 0] as [number, number, number, number],
};
const LONG = 'BATCH 2026-11-18-0001 EXAMPLE PRODUCT NAME THAT IS FAR TOO LONG FOR ITS BOX';

const textSchema = (overrides: Partial<TextSchema> = {}): TextSchema => ({
  name: 'label',
  type: 'text',
  content: '',
  position: { x: 10, y: 10 },
  width: 40,
  height: 10,
  alignment: 'center',
  verticalAlignment: 'middle',
  fontColor: '#000000',
  backgroundColor: '',
  lineHeight: 1,
  characterSpacing: 0,
  fontSize: 12,
  ...overrides,
});

// Renders one text field on a real page, recording the operators pushed and the text drawn.
const render = async (value: string, schema: TextSchema) => {
  const pdfDoc = await pdfLib.PDFDocument.create();
  // As the generator does: fontkit embeds the custom fonts.
  (pdfDoc as unknown as { registerFontkit: (kit: unknown) => void }).registerFontkit(fontkit);
  const page = pdfDoc.addPage([mm2pt(210), mm2pt(297)]);
  const pushOperators = vi.spyOn(page, 'pushOperators');
  const drawText = vi.spyOn(page, 'drawText');
  await pdfRender({
    value,
    schema,
    pdfDoc,
    pdfLib,
    page,
    options: { font: FONT },
    basePdf: BASE_PDF,
    _cache: new Map(),
  } as Parameters<typeof pdfRender>[0]);
  const scaling = pushOperators.mock.calls
    .flat()
    .map(String)
    .filter((op) => op.endsWith(' Tz'))
    .map((op) => Number(op.split(' ')[0]));
  return {
    scaling,
    drawn: drawText.mock.calls.map(([text, options]) => ({ text, x: options?.x })),
  };
};

const naturalWidth = async (text: string, schema: TextSchema) =>
  widthOfTextAtSize(text, await getFontKitFont(undefined, FONT, new Map()), schema.fontSize, 0);

describe('squeezeToFit helpers', () => {
  it('wraps only at newlines when squeezing', () => {
    expect(getWrapWidthInPt({ squeezeToFit: true }, 100)).toBe(Number.POSITIVE_INFINITY);
    expect(getWrapWidthInPt({}, 100)).toBe(100);
  });

  it('narrows only lines wider than the box', () => {
    expect(getSqueezeRatio({ squeezeToFit: true }, 200, 100)).toBe(0.5);
    expect(getSqueezeRatio({ squeezeToFit: true }, 80, 100)).toBe(1);
    expect(getSqueezeRatio({}, 200, 100)).toBe(1);
  });
});

describe('squeezeToFit in the PDF', () => {
  it('draws a too-long line once, horizontally scaled to the box width, then resets the scaling', async () => {
    const schema = textSchema({ squeezeToFit: true });
    const { scaling, drawn } = await render(LONG, schema);

    const expected = (mm2pt(schema.width) / (await naturalWidth(LONG, schema))) * 100;
    expect(drawn.map((d) => d.text)).toEqual([LONG]);
    expect(scaling).toHaveLength(2);
    expect(scaling[0]).toBeCloseTo(expected, 2);
    expect(scaling[1]).toBe(100);
    // A squeezed line fills the box, so a centred one starts at the box's left edge.
    expect(drawn[0].x).toBeCloseTo(mm2pt(schema.position.x), 3);
  });

  it('leaves a line that fits alone', async () => {
    const { scaling, drawn } = await render('SHORT', textSchema({ squeezeToFit: true }));
    expect(scaling).toEqual([]);
    expect(drawn.map((d) => d.text)).toEqual(['SHORT']);
  });

  it('squeezes each line separately, breaking only at newlines', async () => {
    const { scaling, drawn } = await render(
      `SHORT\n${LONG}`,
      textSchema({ squeezeToFit: true, height: 20 }),
    );
    expect(drawn.map((d) => d.text)).toEqual(['SHORT', LONG]);
    expect(scaling).toHaveLength(2);
    expect(scaling[1]).toBe(100);
  });

  it('wraps as before without the option', async () => {
    const { scaling, drawn } = await render(LONG, textSchema({ height: 40 }));
    expect(scaling).toEqual([]);
    expect(drawn.length).toBeGreaterThan(1);
  });

  it('squeezes what dynamicFontSize could not shrink enough', async () => {
    const schema = textSchema({
      squeezeToFit: true,
      dynamicFontSize: { min: 10, max: 12, fit: 'horizontal' },
    });
    const { scaling, drawn } = await render(LONG, schema);
    expect(drawn).toHaveLength(1);
    const atMin = await naturalWidth(LONG, { ...schema, fontSize: 10 });
    expect(scaling[0]).toBeCloseTo((mm2pt(schema.width) / atMin) * 100, 2);
  });
});

describe('squeezeToFit in dynamic layout', () => {
  it('expands to the number of lines, not to wrapped lines', async () => {
    const args = {
      basePdf: BASE_PDF,
      options: { font: FONT },
      _cache: new Map<string | number, unknown>(),
    };
    // A box shorter than one line, so the measured height decides; heights has one entry per line.
    const expand = { height: 1, overflow: 'expand' as const };
    const squeezed = await getDynamicLayoutForText(LONG, {
      ...args,
      schema: textSchema({ ...expand, squeezeToFit: true }),
    });
    const oneLine = await getDynamicLayoutForText('SHORT', {
      ...args,
      schema: textSchema({ ...expand, squeezeToFit: true }),
    });
    const wrapped = await getDynamicLayoutForText(LONG, { ...args, schema: textSchema(expand) });

    expect(squeezed.heights).toEqual(oneLine.heights);
    expect(squeezed.heights).toHaveLength(1);
    expect(wrapped.heights.length).toBeGreaterThan(1);
  });
});
