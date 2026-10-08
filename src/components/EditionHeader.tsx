import { StyleSheet, View } from 'react-native';

import { Txt } from './Txt';
import { parseDateKey } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER } from '@/theme/tokens';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The date at the foot of the cover, in the theme's display type.
 * Centered themes put the weekday first with the date spaced out under it (like a title card);
 * the others lead with the small date line.
 */
export function EditionHeader({ date }: { date: string }) {
  const { theme } = useTheme();
  const d = parseDateKey(date);
  const weekday = WEEKDAYS[d.getDay()];
  const line = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const center = theme.layout.heroAlign === 'center';

  const title = (
    <Txt variant="displayXL" align={center ? 'center' : 'left'} numberOfLines={1} adjustsFontSizeToFit>
      {weekday}
    </Txt>
  );
  const sub = (
    <Txt variant="spaced" tone="secondary" align={center ? 'center' : 'left'}>
      {line}
    </Txt>
  );

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]}`}
      style={[styles.wrap, center && styles.center]}>
      {center ? (
        <>
          {title}
          {sub}
        </>
      ) : (
        <>
          {sub}
          {title}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER, gap: 6 },
  center: { alignItems: 'center', gap: 10 },
});
