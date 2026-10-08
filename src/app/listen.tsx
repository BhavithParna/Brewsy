import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { listenToDate } from '@/audio/listen';
import { todayKey } from '@/data/editions';

/**
 * brewsy://listen (optionally ?mode=quick|full): starts today's briefing.
 * Used by Siri Shortcuts ("Open URL"), the Android app shortcuts and voice assistants.
 */
export default function ListenLink() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  useEffect(() => {
    listenToDate(todayKey(), mode === 'quick' || mode === 'full' ? mode : undefined);
  }, [mode]);

  return <Redirect href="/" />;
}
