import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getHospitalAnalyticsApi } from '../../api/appointmentApi';

const URGENCY_META = {
  low: { label: 'Thấp', color: COLORS.success },
  medium: { label: 'Trung bình', color: COLORS.warning },
  high: { label: 'Cao', color: COLORS.danger },
};

const chartConfig = {
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: COLORS.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(13, 148, 136, ${opacity})`,
  labelColor: () => COLORS.textSecondary,
  barPercentage: 0.6,
};

export default function DoctorAnalyticsScreen() {
  const { isTabletOrDesktop, width } = useResponsive();
  const chartWidth = isTabletOrDesktop ? Math.min(width * 0.44, 520) : Math.min(width - 64, 400);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getHospitalAnalyticsApi();
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError('Không thể tải dữ liệu thống kê');
      }
    } catch (err) {
      console.error('LOAD_ANALYTICS_ERROR:', err);
      setError(err.response?.data?.message || 'Lỗi khi tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu báo cáo thống kê...</Text>
        </View>
      </ResponsiveContainer>
    );
  }

  if (error) {
    return (
      <ResponsiveContainer style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveContainer>
    );
  }

  const urgencyData = (data?.urgency_summary || [])
    .filter((row) => URGENCY_META[row.urgency_level])
    .map((row) => ({
      name: URGENCY_META[row.urgency_level].label,
      population: row.total,
      color: URGENCY_META[row.urgency_level].color,
      legendFontColor: COLORS.textSecondary,
      legendFontSize: 12,
    }));

  const roomLoad = data?.room_load || [];
  const barData = {
    labels: roomLoad.map((room) => room.room_code),
    datasets: [{ data: roomLoad.map((room) => room.total) }],
  };

  const topServices = data?.top_services || [];

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Báo Cáo & Thống Kê Viện 📊</Text>
          <Text style={styles.subtitle}>Bảng điều khiển trực quan hóa dữ liệu vận hành và hiệu suất khám bệnh</Text>
        </View>

        <View style={[styles.dashboardGrid, isTabletOrDesktop && styles.dashboardGridDesktop]}>
          {/* Card Pie Chart */}
          <View style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
            <Text style={styles.cardTitle}>🚨 Tỷ lệ cảnh báo AI theo mức độ</Text>
            <Text style={styles.cardSubtitle}>Phân loại mức độ cấp cứu từ các lượt tư vấn trực tuyến</Text>
            {urgencyData.length > 0 ? (
              <View style={styles.chartWrapper}>
                <PieChart
                  data={urgencyData}
                  width={chartWidth}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="12"
                  absolute
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu tư vấn AI</Text>
            )}
          </View>

          {/* Card Bar Chart */}
          <View style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
            <Text style={styles.cardTitle}>🏥 Mật độ ca khám theo phòng chuyên khoa</Text>
            <Text style={styles.cardSubtitle}>Khối lượng ca khám được tiếp nhận tại các phòng</Text>
            {roomLoad.length > 0 ? (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={barData}
                  width={chartWidth}
                  height={220}
                  chartConfig={chartConfig}
                  fromZero
                  showValuesOnTopOfBars
                  style={styles.barChart}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu ca khám</Text>
            )}
          </View>

          {/* Card Top Services */}
          <View style={[styles.card, styles.cardFullWidth]}>
            <Text style={styles.cardTitle}>🏆 Top dịch vụ được sử dụng nhiều nhất</Text>
            <Text style={styles.cardSubtitle}>Các dịch vụ thú y có số lượt đăng ký cao nhất</Text>
            {topServices.length > 0 ? (
              <View style={styles.servicesGrid}>
                {topServices.map((service, index) => (
                  <View key={service.id || index} style={styles.rankRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                    </View>
                    <Text style={styles.rankName} numberOfLines={1}>{service.service_name}</Text>
                    <Text style={styles.rankCount}>{service.total} lượt khám</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu dịch vụ</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  dashboardGrid: {
    paddingHorizontal: 16,
    gap: 16,
  },
  dashboardGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    ...SHADOWS.sm,
  },
  cardDesktop: {
    flex: 1,
    minWidth: 340,
  },
  cardFullWidth: {
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  barChart: {
    borderRadius: 12,
  },
  servicesGrid: {
    gap: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  rankBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rankName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rankCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
