import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

/** Opens an article in the in-app browser, falling back to the system browser. */
export async function openLink(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: '#121212',
      controlsColor: '#FFFFFF',
      enableBarCollapsing: true,
      showTitle: true,
    });
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}
