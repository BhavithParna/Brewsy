import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_600SemiBold_Italic } from '@expo-google-fonts/barlow/600SemiBold_Italic';
import { Barlow_700Bold_Italic } from '@expo-google-fonts/barlow/700Bold_Italic';
import { Barlow_800ExtraBold_Italic } from '@expo-google-fonts/barlow/800ExtraBold_Italic';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { Inter_300Light } from '@expo-google-fonts/inter/300Light';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { SpaceGrotesk_300Light } from '@expo-google-fonts/space-grotesk/300Light';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { Syncopate_400Regular } from '@expo-google-fonts/syncopate/400Regular';
import { Syncopate_700Bold } from '@expo-google-fonts/syncopate/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { hydrateDownloads } from '@/audio/downloads';
import { progressStore } from '@/audio/progress';
import { SheetHost } from '@/components/SheetHost';
import { ToastHost } from '@/components/Toast';
import { applyDevUrlFlags } from '@/dev/previewState';
import { useAppSync } from '@/hooks/useAppSync';
import { useAppUpdates } from '@/hooks/useAppUpdates';
import { configureNotifications } from '@/lib/notifications';
import { deepDiveStore } from '@/state/deepDives';
import { readingListStore } from '@/state/readingList';
import { hydrateSeen } from '@/state/seen';
import { settingsStore, useSettings } from '@/state/settings';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
configureNotifications();

// Load saved settings, the Reading List, cached explainers and listening progress before the first screen.
const hydrated = Promise.all([
  settingsStore.hydrate(),
  readingListStore.hydrate(),
  deepDiveStore.hydrate(),
  progressStore.hydrate(),
  hydrateDownloads(),
  hydrateSeen(),
]).then(applyDevUrlFlags);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Theme typefaces (see themes.ts).
    Syncopate_400Regular,
    Syncopate_700Bold,
    SpaceGrotesk_300Light,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_600SemiBold_Italic,
    Barlow_700Bold_Italic,
    Barlow_800ExtraBold_Italic,
  });
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    hydrated.then(() => setStoresReady(true));
  }, []);

  const ready = (fontsLoaded || !!fontError) && storesReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppThemeProvider>
        <SheetHost>
          <AppStack />
          <ToastHost />
        </SheetHost>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const { theme } = useTheme();
  const { onboarded } = useSettings();
  useAppSync();
  useAppUpdates();

  const base = theme.isDark ? DarkTheme : DefaultTheme;
  // Navigation backgrounds match the app theme so transitions never flash white.
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: theme.colors.bg, card: theme.colors.bg },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.colors.bg } }}>
        {/* Until onboarding is finished, only the onboarding screen exists. */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="driving" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="listen" options={{ animation: 'none' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E140E' },
});
