import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { GlassCard } from '../GlassCard';
import { Txt } from '../Txt';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, radii } from '@/theme/tokens';

// The building blocks of the Settings sheet, shared by its sections (settings/*.tsx).

export function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <View style={settingsStyles.group}>
      <Txt variant="kicker" tone="tertiary" style={settingsStyles.groupTitle} accessibilityRole="header">
        {title}
      </Txt>
      <GlassCard radius={radii.lg} style={settingsStyles.card}>
        {children}
      </GlassCard>
      {footer && (
        <Txt variant="caption" tone="tertiary" style={settingsStyles.footer}>
          {footer}
        </Txt>
      )}
    </View>
  );
}

export function Divider() {
  const { theme } = useTheme();
  return <View style={[settingsStyles.divider, { backgroundColor: theme.colors.hairline }]} />;
}

/** Track and thumb colors for switches, in the theme's accent. */
export function useSwitchColors() {
  const { theme } = useTheme();
  return {
    trackColor: { false: theme.colors.glassBorder, true: theme.colors.accent },
    thumbColor: '#FFFFFF',
    ios_backgroundColor: theme.colors.glassBorder,
  };
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const switchColors = useSwitchColors();
  return (
    <View style={settingsStyles.row}>
      <View style={settingsStyles.flex}>
        <Txt variant="label">{title}</Txt>
        {subtitle && (
          <Txt variant="bodySm" tone="tertiary">
            {subtitle}
          </Txt>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} {...switchColors} />
    </View>
  );
}

export function LinkRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={settingsStyles.row}>
      {icon && <View>{icon}</View>}
      <View style={settingsStyles.flex}>
        <Txt variant="label">{title}</Txt>
        {subtitle && (
          <Txt variant="bodySm" tone="tertiary">
            {subtitle}
          </Txt>
        )}
      </View>
      <View>
        <ChevronRight size={18} color={theme.colors.textTertiary} />
      </View>
    </Pressable>
  );
}

export const settingsStyles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: 10 },
  groupTitle: { paddingLeft: 6 },
  card: { paddingHorizontal: 16 },
  footer: { paddingHorizontal: 6 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowStack: { paddingVertical: 14, gap: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  padded: { paddingVertical: 16, minHeight: TAP },
  divider: { height: 1 },
});
