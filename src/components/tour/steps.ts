import type { RefObject } from 'react';
import type { View } from 'react-native';

import { navTargets } from '../navTargets';
import { tourTargets } from './targets';

/** What a step points at, worked out when the step comes up. */
export type TourTarget = {
  ref: RefObject<View | null>;
  /**
   * top: scroll the page to the very top first · reveal: scroll only if the target isn't comfortably
   * on screen · stay: measure it where it is.
   */
  scroll: 'top' | 'reveal' | 'stay';
  /** control: the theme's button shape · card: its card corners · bar: a full-width strip. */
  shape: 'control' | 'card' | 'bar';
  /** Points to leave off the top of the measured box (the pinned bar's status-bar padding). */
  trimTop?: number;
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** null skips the step (its element isn't there, e.g. an edition without stories). */
  target: () => TourTarget | null;
};

type Options = {
  /** The edition has at least one story card. */
  hasStory: boolean;
  /** The bar pinned to the top is showing (the page has scrolled past the jump rail). */
  isPinned: () => boolean;
  /** Height of the status bar strip the pinned bar covers. */
  statusTop: number;
};

/**
 * The first-run tour of Today, top to bottom, so the page only ever scrolls one way.
 * Copy: one short title, one or two plain sentences.
 */
export function todaySteps({ hasStory, isPinned, statusTop }: Options): TourStep[] {
  return [
    {
      id: 'days',
      title: 'Today and earlier',
      body: 'Swipe sideways to move between days. The calendar opens older editions.',
      target: () => ({ ref: navTargets.days, scroll: 'top', shape: 'control' }),
    },
    {
      id: 'rail',
      title: 'Jump to any topic',
      body: 'Tap a topic to go straight to it. The list icon shows everything in this edition.',
      target: () => ({ ref: navTargets.rail, scroll: 'reveal', shape: 'bar' }),
    },
    {
      id: 'listen',
      title: 'Rather listen?',
      body: 'Hear the whole edition read aloud. It keeps playing with the screen off.',
      target: () => ({ ref: tourTargets.listen, scroll: 'reveal', shape: 'card' }),
    },
    {
      id: 'save',
      title: 'Keep it for later',
      body: 'Play a single story, share it, or save it for tonight or the weekend. Saved stories wait in your Reading List.',
      target: () => (hasStory ? { ref: tourTargets.storyActions, scroll: 'reveal', shape: 'control' } : null),
    },
    {
      id: 'more',
      title: 'Go deeper',
      body: 'Learn more adds the background and who’s involved. At the end, ask a question or ask for more stories like it.',
      target: () => (hasStory ? { ref: tourTargets.storyMore, scroll: 'reveal', shape: 'control' } : null),
    },
    {
      id: 'bar',
      title: 'Always in reach',
      body: 'Topics, search and settings stay at the top while you read. Settings holds themes, text size and your topics.',
      // Once the page has scrolled, the pinned bar; otherwise settings on the cover.
      target: () =>
        isPinned()
          ? { ref: navTargets.pinnedBar, scroll: 'stay', shape: 'bar', trimTop: statusTop }
          : { ref: navTargets.settings, scroll: 'top', shape: 'control' },
    },
  ];
}
