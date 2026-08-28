import { useWindowDimensions } from 'react-native';

export const useResponsive = () => {
  const { width } = useWindowDimensions();
  const isTabletOrDesktop = width >= 768;
  const containerMaxWidth = 800;

  return {
    width,
    isTabletOrDesktop,
    containerMaxWidth,
  };
};