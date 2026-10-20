import { classicHeadings } from './classic';
import { filmHeadings } from './films';
import { glassHeadings } from './glass';
import { horrorHeadings } from './horror';
import type { HeadingRegistry } from './types';

export type { HeadingProps } from './types';

/** Themes that draw their own section headings. */
export const CUSTOM_HEADINGS: HeadingRegistry = {
  ...classicHeadings,
  ...glassHeadings,
  ...filmHeadings,
  ...horrorHeadings,
};
