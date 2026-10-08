import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pill } from './Pill';
import { formatWakeTime } from '@/lib/format';
import type { WakeTime } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

const QUICK_TIMES: WakeTime[] = [
  { hour: 5, minute: 0 },
  { hour: 5, minute: 30 },
  { hour: 6, minute: 0 },
  { hour: 6, minute: 30 },
  { hour: 7, minute: 0 },
  { hour: 7, minute: 30 },
];

type Props = {
  value: WakeTime;
  onChange: (t: WakeTime) => void;
  center?: boolean;
};

/** Quick time pills plus "Other…" for any time (system time picker). */
export function WakeTimePicker({ value, onChange, center }: Props) {
  const { theme } = useTheme();
  const [iosPicker, setIosPicker] = useState(false);
  const isQuick = QUICK_TIMES.some((t) => t.hour === value.hour && t.minute === value.minute);

  const asDate = new Date();
  asDate.setHours(value.hour, value.minute, 0, 0);
  const fromDate = (d: Date) => onChange({ hour: d.getHours(), minute: d.getMinutes() });

  const pickOther = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate,
        mode: 'time',
        is24Hour: false,
        onChange: (event, date) => {
          if (event.type === 'set' && date) fromDate(date);
        },
      });
    } else {
      setIosPicker((v) => !v);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.pills, center && styles.center]}>
        {QUICK_TIMES.map((t) => {
          const active = t.hour === value.hour && t.minute === value.minute;
          return (
            <Pill
              key={`${t.hour}:${t.minute}`}
              label={formatWakeTime(t)}
              size="md"
              variant={active ? 'solid' : 'glass'}
              color={theme.colors.inverseBg}
              selected={active}
              onPress={() => onChange(t)}
            />
          );
        })}
        {Platform.OS !== 'web' && (
          <Pill
            label={isQuick ? 'Other…' : formatWakeTime(value)}
            size="md"
            variant={isQuick ? 'outline' : 'solid'}
            color={isQuick ? undefined : theme.colors.inverseBg}
            selected={!isQuick}
            onPress={pickOther}
            accessibilityLabel="Pick another time"
          />
        )}
      </View>
      {iosPicker && Platform.OS === 'ios' && (
        <DateTimePicker
          mode="time"
          display="spinner"
          value={asDate}
          themeVariant={theme.isDark ? 'dark' : 'light'}
          onChange={(_, date) => date && fromDate(date)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  center: { justifyContent: 'center' },
});
