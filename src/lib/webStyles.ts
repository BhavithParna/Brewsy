import { Platform, type TextStyle } from 'react-native';

/**
 * Web preview only: browsers draw their own focus ring around text fields, on top of the field's
 * themed border. Phones don't, so this does nothing there. (`outlineStyle: 'none'` is valid CSS
 * but not in React Native's types.)
 */
export const noFocusRing = (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {}) as TextStyle;
