import { Search, Settings as SettingsIcon, type LucideIcon } from 'lucide-react-native';
import type { Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrewsyLogo } from './BrewsyLogo';
import { GlassIconButton } from './GlassIconButton';
import { Tap } from '@/components/Tap';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP } from '@/theme/tokens';

type Props = {
  onSearch: () => void;
  onSettings: () => void;
  /** Long-press on the logo (Today uses it to preview the loading, empty and error screens). */
  onBrandLongPress?: () => void;
  /** For coach marks. */
  settingsRef?: Ref<View>;
  searchRef?: Ref<View>;
  onSettingsLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * The row across the top of the cover photo: the Brewsy logo with search and settings.
 * Centered themes set the logo between the two buttons; the others lead with it.
 */
export function CoverBar({ onSearch, onSettings, onBrandLongPress, settingsRef, searchRef, onSettingsLayout }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const center = theme.layout.heroAlign === 'center';

  const brand = (
    <Tap
      onLongPress={onBrandLongPress}
      delayLongPress={600}
      disabled={!onBrandLongPress}
      style={styles.brand}
      accessibilityRole="header"
      accessibilityLabel="Brewsy">
      <BrewsyLogo color={theme.colors.onCover} accessible={false} />
    </Tap>
  );
  const search = (
    <View ref={searchRef}>
      <CoverButton icon={Search} label="Search" onPress={onSearch} />
    </View>
  );
  const settings = (
    <View ref={settingsRef} onLayout={onSettingsLayout}>
      <CoverButton icon={SettingsIcon} label="Settings" onPress={onSettings} />
    </View>
  );

  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      {center ? (
        <>
          {search}
          {brand}
          {settings}
        </>
      ) : (
        <>
          {brand}
          <View style={styles.actions}>
            {search}
            {settings}
          </View>
        </>
      )}
    </View>
  );
}

function CoverButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <GlassIconButton
      variant="overlay"
      icon={<Icon size={18} color={theme.colors.onCover} strokeWidth={1.7} />}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 14,
  },
  brand: { justifyContent: 'center', minHeight: TAP },
  actions: { flexDirection: 'row', gap: 10 },
});
