import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../theme';

const STAR_POINTS = [
  { x: '4%', y: '9%', size: 2, opacity: 0.2 },
  { x: '10%', y: '18%', size: 2, opacity: 0.28 },
  { x: '13%', y: '36%', size: 1.5, opacity: 0.34 },
  { x: '18%', y: '55%', size: 4, opacity: 0.82 },
  { x: '20%', y: '7%', size: 2, opacity: 0.44 },
  { x: '23%', y: '67%', size: 1.5, opacity: 0.28 },
  { x: '28%', y: '28%', size: 2, opacity: 0.42 },
  { x: '31%', y: '48%', size: 2, opacity: 0.24 },
  { x: '37%', y: '13%', size: 3, opacity: 0.68 },
  { x: '39%', y: '72%', size: 2, opacity: 0.42 },
  { x: '43%', y: '6%', size: 1.5, opacity: 0.3 },
  { x: '47%', y: '43%', size: 2, opacity: 0.24 },
  { x: '51%', y: '61%', size: 3, opacity: 0.52 },
  { x: '58%', y: '24%', size: 2, opacity: 0.44 },
  { x: '60%', y: '11%', size: 1.5, opacity: 0.28 },
  { x: '63%', y: '36%', size: 2, opacity: 0.34 },
  { x: '68%', y: '60%', size: 2, opacity: 0.38 },
  { x: '71%', y: '78%', size: 3, opacity: 0.5 },
  { x: '76%', y: '18%', size: 4, opacity: 0.86 },
  { x: '79%', y: '51%', size: 1.5, opacity: 0.28 },
  { x: '84%', y: '39%', size: 2, opacity: 0.3 },
  { x: '87%', y: '8%', size: 2, opacity: 0.5 },
  { x: '91%', y: '68%', size: 3, opacity: 0.58 },
  { x: '94%', y: '25%', size: 1.5, opacity: 0.26 },
  { x: '7%', y: '73%', size: 2, opacity: 0.4 },
  { x: '21%', y: '79%', size: 3, opacity: 0.58 },
  { x: '33%', y: '88%', size: 1.5, opacity: 0.28 },
  { x: '54%', y: '82%', size: 2, opacity: 0.34 },
  { x: '66%', y: '91%', size: 1.5, opacity: 0.3 },
  { x: '82%', y: '87%', size: 2, opacity: 0.38 },
  { x: '95%', y: '91%', size: 2, opacity: 0.24 },
] as const;

export function AnimatedStars(): React.ReactElement {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 9000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [progress]);

  const starsStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + progress.value * 0.2,
    transform: [{ translateY: progress.value * -10 }, { translateX: progress.value * 5 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.starsLayer, starsStyle]}>
      {STAR_POINTS.map((star, index) => (
        <View
          key={`${star.x}-${star.y}-${index}`}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function WarningTriangleIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M9 1L17 16H1L9 1Z" fill={COLORS.YELLOW} />
      <Path d="M9 6V10" stroke={COLORS.TEXT_BLACK} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={9} cy={13} r={1} fill={COLORS.TEXT_BLACK} />
    </Svg>
  );
}

export function CheckCircleIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.SUCCESS_GREEN} />
      <Path
        d="M5 9L7.6 11.6L13 6.2"
        stroke={COLORS.WHITE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ErrorXIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.DANGER_RED} />
      <Path d="M6 6L12 12M12 6L6 12" stroke={COLORS.WHITE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function StatusIconFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={styles.statusIconFrame}>{children}</View>;
}

const styles = StyleSheet.create({
  starsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.WHITE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 4,
  },
  statusIconFrame: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
