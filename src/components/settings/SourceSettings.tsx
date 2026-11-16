import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { OUTLET_REGION, SOURCE_GROUPS } from '../../../supabase/functions/_shared/sources';
import { Txt } from '../Txt';
import { Divider, Group, ToggleRow, settingsStyles as styles } from './SettingsParts';
import { Tap } from '@/components/Tap';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** World outlets, plus the ones that only feed the reader's own local section. */
function sourceGroupsFor(region: Settings['region']) {
  return SOURCE_GROUPS.map((g) => ({
    ...g,
    outlets: g.outlets.filter((o) => !OUTLET_REGION[o] || OUTLET_REGION[o] === region),
  })).filter((g) => g.outlets.length > 0);
}

/** Settings → Sources: every outlet Brewsy reads, by kind, each one switchable. */
export function SourceSettings() {
  const { theme } = useTheme();
  const settings = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  const groups = sourceGroupsFor(settings.region);

  const toggleOutlet = (outlet: string, on: boolean) => {
    updateSettings({
      disabledOutlets: on
        ? settings.disabledOutlets.filter((o) => o !== outlet)
        : [...settings.disabledOutlets, outlet],
    });
  };

  return (
    <Group footer="Brewsy reads all of these every morning. Turn one off to drop its links, and any story only it reported. The full list, with each source's trust level, is in supabase/functions/_shared/sources.ts.">
      {groups.map((group, gi) => {
        const on = group.outlets.filter((o) => !settings.disabledOutlets.includes(o)).length;
        const expanded = open === group.category;
        return (
          <View key={group.category}>
            {gi > 0 && <Divider />}
            <Tap
              onPress={() => setOpen(expanded ? null : group.category)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={styles.row}>
              <View style={styles.flex}>
                <Txt variant="label">{group.label}</Txt>
                <Txt variant="bodySm" tone="tertiary">
                  {on === group.outlets.length ? `All ${on} on` : `${on} of ${group.outlets.length} on`}
                </Txt>
              </View>
              <View>
                {expanded ? (
                  <ChevronUp size={18} color={theme.colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={theme.colors.textTertiary} />
                )}
              </View>
            </Tap>
            {expanded &&
              group.outlets.map((outlet) => (
                <View key={outlet}>
                  <Divider />
                  <ToggleRow
                    title={outlet}
                    value={!settings.disabledOutlets.includes(outlet)}
                    onChange={(value) => toggleOutlet(outlet, value)}
                  />
                </View>
              ))}
          </View>
        );
      })}
    </Group>
  );
}

/** One line for the Settings list: how many outlets are on. */
export function sourceSummary(s: Settings): string {
  const all = sourceGroupsFor(s.region).flatMap((g) => g.outlets);
  const on = all.filter((o) => !s.disabledOutlets.includes(o)).length;
  return on === all.length ? `All ${all.length} outlets on` : `${on} of ${all.length} outlets on`;
}
