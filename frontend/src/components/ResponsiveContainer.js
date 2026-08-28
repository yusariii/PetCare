import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../constants/theme';

export default function ResponsiveContainer({ children, style }) {
  const { width } = useWindowDimensions();
  const isLarge = width >= 768;

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, isLarge && styles.largeScreen, style]}>
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
    maxWidth: 750,
    backgroundColor: COLORS.background,
  },
  largeScreen: {
    paddingHorizontal: 24,
  },
});