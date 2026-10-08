import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
};

/**
 * Pressable that springs down slightly while pressed.
 * With "Reduce motion" on, it dims instead of scaling.
 */
export function PressableScale({ scaleTo = 0.97, style, onPressIn, onPressOut, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduceMotion
      ? { opacity: 1 - 0.18 * p }
      : { transform: [{ scale: 1 - (1 - scaleTo) * p }] };
  });

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        pressed.set(reduceMotion ? withTiming(1, { duration: 80 }) : withSpring(1, springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0, springs.release));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
