/**
 * SkeletonLoader
 * Animated loading placeholder for content
 *
 * Architecture: Atom component (< 150 lines)
 * Props: 4 (width, height, borderRadius, style)
 * State: 1 (animation ref)
 * Complexity: Simple presentation component
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

const SkeletonLoader = ({ width, height, borderRadius, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

SkeletonLoader.propTypes = {
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  borderRadius: PropTypes.number,
  style: PropTypes.object,
};

SkeletonLoader.defaultProps = {
  width: '100%',
  height: 20,
  borderRadius: 4,
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.CARD_BG,
  },
});

export default React.memo(SkeletonLoader);
