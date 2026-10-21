import { classicHeadings } from './classic';
import { filmHeadings } from './films';
import { glassHeadings } from './glass';
import { horrorHeadings } from './horror';
import type { HeadingRegistry } from './types';
import { whalesHeadings } from './whales';

export type { HeadingProps } from './types';

/** Themes that draw their own section headings. */
export const CUSTOM_HEADINGS: HeadingRegistry = {
  ...classicHeadings,
  ...glassHeadings,
  ...whalesHeadings,
  ...filmHeadings,
  ...horrorHeadings,
};
