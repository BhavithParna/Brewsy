import type { ComponentType } from 'react';

import type { ThemeName } from '@/theme/themes';

/** What every section heading gets (see TopicHeading in EditionSections.tsx). */
export type HeadingProps = {
  label: string;
  /** Number of stories, when the section has a count. */
  count?: number;
  /** True for topic sections (AI, Business…); false/undefined for Also happening, Markets, etc. */
  cover?: boolean;
  /** The lead story's photo, when there is one. */
  imageUrl?: string | null;
  /** 1-based position among the topic sections (for numbered styles); undefined for other sections. */
  index?: number;
};

/** A theme's own section heading, replacing the built-in styles (rule, title, prompt…). */
export type HeadingRegistry = Partial<Record<ThemeName, ComponentType<HeadingProps>>>;
