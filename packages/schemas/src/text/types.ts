import type { Schema } from '@pdfme/common';
import type { Font as FontKitFont } from 'fontkit';
import type { BoxDimension } from '../box.js';

export type ALIGNMENT = 'left' | 'center' | 'right' | 'justify';
export type VERTICAL_ALIGNMENT = 'top' | 'middle' | 'bottom';
export type DYNAMIC_FONT_SIZE_FIT = 'horizontal' | 'vertical';
export type TEXT_FORMAT = 'plain' | 'inline-markdown';
export type TEXT_OVERFLOW = 'visible' | 'expand';
export type FONT_VARIANT_FALLBACK = 'synthetic' | 'plain' | 'error';

export type FontVariants = {
  bold?: string;
  italic?: string;
  boldItalic?: string;
  code?: string;
};

export type RichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  href?: string;
};

export type FontWidthCalcValues = {
  font: FontKitFont;
  fontSize: number;
  characterSpacing: number;
  boxWidthInPt: number;
};

export type TextSchema = Schema & {
  fontName?: string;
  textFormat?: TEXT_FORMAT;
  fontVariants?: FontVariants;
  fontVariantFallback?: FONT_VARIANT_FALLBACK;
  alignment: ALIGNMENT;
  verticalAlignment: VERTICAL_ALIGNMENT;
  fontSize: number;
  lineHeight: number;
  strikethrough?: boolean;
  underline?: boolean;
  characterSpacing: number;
  dynamicFontSize?: {
    min: number;
    max: number;
    fit: DYNAMIC_FONT_SIZE_FIT;
  };
  /**
   * Keep each line on one line and narrow any line wider than the box until it fits, keeping the
   * font size (horizontal scaling, like CSS `scaleX`). Lines only break at newlines. Applied after
   * `dynamicFontSize`. Plain text only: ignored with `textFormat: 'inline-markdown'`.
   */
  squeezeToFit?: boolean;
  overflow?: TEXT_OVERFLOW;
  fontColor: string;
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: BoxDimension;
  padding?: BoxDimension;
};
