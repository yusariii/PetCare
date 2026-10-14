import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isMobile = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTabletOrDesktop = width >= BREAKPOINTS.tablet;
  const isWideScreen = width >= BREAKPOINTS.wide;

  // Modern maximum widths for layouts: generous on desktop, clean on tablet
  const containerMaxWidth = isWideScreen ? 1280 : isDesktop ? 1120 : isTablet ? 760 : '100%';

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isTabletOrDesktop,
    isWideScreen,
    containerMaxWidth,
    // Helper to calculate columns for grid layouts
    gridColumns: isWideScreen ? 3 : isTabletOrDesktop ? 2 : 1,
  };
};