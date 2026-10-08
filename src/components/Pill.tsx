import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, capsLabel, radii, withAlpha } from '@/theme/tokens';

type Props = {
  label: string;
  /**
   * glass: frosted (on photos use overlay)  ·  solid: filled with `color`
   * soft: tinted with `color`  ·  outline: hairline border only
   */
  variant?: 'glass' | 'overlay' | 'solid' | 'soft' | 'outline';
  color?: string;
  /** Show a small colored dot before the label. */
  dot?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  blurTarget?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
};

export function Pill({
  label,
  variant = 'glass',
  color,
  dot,
  icon,
  size = 'sm',
  onPress,
  selected,
  accessibilityLabel,
  blurTarget,
  style,
}: Props) {
  const { theme } = useTheme();
  const accent = color ?? theme.colors.accent;
  const caps = theme.layout.capsButtons;
  const height = size === 'sm' ? 26 : 36;
  const padH = size === 'sm' ? 10 : 16;

  const textColor =
    variant === 'solid'
      ? theme.colors.inverseText
      : variant === 'overlay'
        ? '#FFFFFF'
        : theme.colors.text;

  const content = (
    <View style={[styles.row, { height, paddingHorizontal: padH }]}>
      {dot && <View style={[styles.dot, { backgroundColor: accent }]} />}
      {icon}
      <Txt
        variant={size === 'sm' ? 'caption' : 'label'}
        color={textColor}
        numberOfLines={1}
        style={size === 'sm' ? styles.smText : caps ? capsLabel : undefined}>
        {label}
      </Txt>
    </View>
  );

  let body: ReactNode;
  if (variant === 'glass' || variant === 'overlay') {
    body = (
      <GlassCard
        radius={radii.pill}
        variant={variant === 'overlay' ? 'overlay' : 'control'}
        blurTarget={blurTarget}
        style={selected && { borderColor: theme.colors.text }}>
        {content}
      </GlassCard>
    );
  } else {
    const bg =
      variant === 'solid' ? accent : variant === 'soft' ? withAlpha(accent, 0.16) : 'transparent';
    const border =
      variant === 'outline' ? theme.colors.glassBorder : variant === 'soft' ? withAlpha(accent, 0.3) : bg;
    body = (
      <View style={[styles.flat, { backgroundColor: bg, borderColor: border, borderRadius: theme.shape.control }]}>
        {content}
      </View>
    );
  }

  if (!onPress) {
    return (
      <View style={style} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }

  // Grow the touch area to at least 44pt without changing the visual size.
  const slop = Math.max(0, (TAP - height) / 2);
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected != null ? { selected } : undefined}
      style={style}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  smText: { letterSpacing: 0.8, textTransform: 'uppercase' },
  flat: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
