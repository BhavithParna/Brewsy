import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from './Txt';
import { GUTTER } from '@/theme/tokens';

type Props = {
  title: string;
  /** Second, dimmer half of the title, e.g. "The 60-second" + "version". */
  muted?: string;
  right?: ReactNode;
};

export function SectionHeader({ title, muted, right }: Props) {
  return (
    <View style={styles.row}>
      <Txt variant="title" accessibilityRole="header">
        {title}
        {muted ? <Txt variant="title" tone="tertiary">{` ${muted}`}</Txt> : null}
      </Txt>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    marginBottom: 14,
    minHeight: 26,
  },
});
