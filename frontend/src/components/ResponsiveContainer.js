import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../constants/theme';
import { useResponsive } from '../utils/responsive';

export default function ResponsiveContainer({ children, style, maxWidth, noPadding = false }) {
  const { isTabletOrDesktop, isDesktop, isWideScreen } = useResponsive();

  const resolvedMaxWidth = maxWidth || (isWideScreen ? 1280 : isDesktop ? 1120 : isTabletOrDesktop ? 880 : '100%');

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.inner,
          { maxWidth: resolvedMaxWidth },
          isTabletOrDesktop && (noPadding ? styles.noPaddingLarge : styles.largeScreen),
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.background,
  },
  largeScreen: {
    paddingHorizontal: 32,
    paddingTop: 85,
    paddingBottom: 24,
  },
  noPaddingLarge: {
    paddingHorizontal: 0,
    paddingTop: 70,
    paddingBottom: 0,
  },
});
