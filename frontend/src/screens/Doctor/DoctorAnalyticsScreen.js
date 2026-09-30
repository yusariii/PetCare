import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
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
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 750) - 48;

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
          <Text style={styles.loadingText}>Đang tải thống kê...</Text>
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

  const urgencyData = (data.urgency_summary || [])
    .filter((row) => URGENCY_META[row.urgency_level])
    .map((row) => ({
      name: URGENCY_META[row.urgency_level].label,
      population: row.total,
      color: URGENCY_META[row.urgency_level].color,
      legendFontColor: COLORS.textSecondary,
      legendFontSize: 12,
    }));

  const roomLoad = data.room_load || [];
  const barData = {
    labels: roomLoad.map((room) => room.room_code),
    datasets: [{ data: roomLoad.map((room) => room.total) }],
  };

  const topServices = data.top_services || [];

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Thống Kê Hoạt Động</Text>
          <Text style={styles.subtitle}>Bảng điều khiển trực quan hóa dữ liệu bệnh viện</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚨 Tỷ lệ cảnh báo AI theo mức độ khẩn cấp</Text>
          {urgencyData.length > 0 ? (
            <PieChart
              data={urgencyData}
              width={chartWidth}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute
            />
          ) : (
            <Text style={styles.emptyText}>Chưa có dữ liệu tư vấn AI</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏥 Mật độ ca khám theo từng phòng</Text>
          {roomLoad.length > 0 ? (
            <BarChart
              data={barData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              fromZero
              showValuesOnTopOfBars
              style={styles.barChart}
            />
          ) : (
            <Text style={styles.emptyText}>Chưa có dữ liệu ca khám</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Top 5 dịch vụ được sử dụng nhiều nhất</Text>
          {topServices.length > 0 ? (
            topServices.map((service, index) => (
              <View key={service.id} style={styles.rankRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                </View>
                <Text style={styles.rankName} numberOfLines={1}>{service.service_name}</Text>
                <Text style={styles.rankCount}>{service.total} lượt</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có dữ liệu dịch vụ</Text>
          )}
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
    paddingBottom: 24,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  barChart: {
    borderRadius: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  rankBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  rankName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  rankCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
