import { StyleSheet, View } from 'react-native';

import { Txt } from '../Txt';
import type { HeadingProps, HeadingRegistry } from './types';
import { GUTTER } from '@/theme/tokens';

/**
 * Glass: a large title the way iOS sets one, with the story count underneath in quiet
 * secondary text. Long titles ("Since this morning") wrap rather than shrink or cut off.
 */
function GlassHeading({ label, count }: HeadingProps) {
  const countLabel = count != null ? `${count} ${count === 1 ? 'story' : 'stories'}` : null;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      accessibilityLabel={countLabel ? `${label}, ${countLabel}` : label}>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
      {countLabel && (
        <Txt variant="body" tone="secondary">
          {countLabel}
        </Txt>
      )}
    </View>
  );
}

/** Section headings for the glass themes, by theme name. Themes not listed use their built-in `layout.sections` style. */
export const glassHeadings: HeadingRegistry = { glass: GlassHeading };

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER + 2, gap: 2 },
});
