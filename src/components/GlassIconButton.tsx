import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

type Props = {
  icon: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  /** Small accent dot in the corner (e.g. new notifications). */
  badge?: boolean;
  size?: number;
  /** 'overlay' when the button sits on a photo. */
  variant?: 'control' | 'overlay';
};

/** Round 44pt frosted button holding a single icon. */
export function GlassIconButton({
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  badge,
  size = TAP,
  variant = 'control',
}: Props) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <GlassCard radius={radii.pill} variant={variant} style={[styles.button, { width: size, height: size }]}>
        {/* Wrapped so the icon stacks above the glass layers on web too. */}
        <View>{icon}</View>
      </GlassCard>
      {badge && (
        <View
          style={[styles.badge, { backgroundColor: theme.colors.accent, borderColor: theme.colors.bg }]}
        />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
