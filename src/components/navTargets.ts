import { createRef } from 'react';
import type { View } from 'react-native';

/**
 * Today's navigation controls, so coach marks can point at them without reaching into the screen:
 *   navTargets.rail.current?.measureInWindow((x, y, width, height) => …)
 * Each ref is set while Today is mounted (and the edition has loaded, for the rail and the bar).
 */
export const navTargets = {
  /** The jump rail in the page, just under the cover: the list icon and one chip per section. */
  rail: createRef<View>(),
  /** Settings on the cover's top row. */
  settings: createRef<View>(),
  /** Search on the cover's top row. */
  search: createRef<View>(),
  /** Today / Yesterday / older editions, on the cover. */
  days: createRef<View>(),
  /** The bar pinned to the top once the page scrolls past the rail (hidden until then). */
  pinnedBar: createRef<View>(),
  /** Settings inside the pinned bar. */
  pinnedSettings: createRef<View>(),
};
