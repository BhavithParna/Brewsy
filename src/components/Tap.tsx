import type { Ref } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

type Props = PressableProps & {
  ref?: Ref<View>;
  /** How far it fades while a finger is on it. */
  dim?: number;
};

/**
 * A plain Pressable that fades a little the moment it's touched, so every row, link and text button
 * answers a tap straight away. Buttons that should spring instead use PressableScale.
 */
export function Tap({ style, dim = 0.55, ...rest }: Props) {
  const live = !rest.disabled && (rest.onPress != null || rest.onLongPress != null);
  return (
    <Pressable
      {...rest}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        live && state.pressed && { opacity: dim },
      ]}
    />
  );
}
