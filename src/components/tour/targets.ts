import { createRef } from 'react';
import type { View } from 'react-native';

/**
 * Things on Today the first-run tour points at, beyond the navigation controls in navTargets.
 * Today hands these refs to the first story and the Listen tile; the tour measures them with
 * measureInWindow. Each is null while its element isn't on screen.
 */
export const tourTargets = {
  /** The Listen tile under the jump rail. */
  listen: createRef<View>(),
  /** Play, share and save on the first story card. */
  storyActions: createRef<View>(),
  /** "Learn more" on the first story card. */
  storyMore: createRef<View>(),
};
