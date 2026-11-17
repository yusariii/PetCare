import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const TIME_SLOTS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const toLocalDateStr = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const toLocalHourSlot = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:00`;
};

/**
 * Kiểm tra 1 mốc thời gian (datetime) có khớp với bộ lọc Ngày (YYYY-MM-DD) và Giờ (HH:00) hay không
 */
export const matchesDateTimeFilter = (datetimeValue, selectedDate, selectedTime) => {
  if (!selectedDate && !selectedTime) return true;
  if (!datetimeValue) return false;

  if (selectedDate) {
    const itemDate = toLocalDateStr(datetimeValue);
    if (itemDate !== selectedDate) return false;
  }

  if (selectedTime) {
    const itemHourSlot = toLocalHourSlot(datetimeValue);
    const targetPrefix = selectedTime.slice(0, 2);
    if (!itemHourSlot.startsWith(targetPrefix)) return false;
  }

  return true;
};

const formatDisplayDate = (dateStr) => {
  const effective = dateStr || getTodayStr();
  const parts = effective.split('-');
  if (parts.length !== 3) return effective;
  const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (effective === getTodayStr()) {
    return `Hôm nay (${formatted})`;
  }
  return formatted;
};

export default function DateTimeFilterBar({
  selectedDate = '',
  onDateChange,
  selectedTime = '',
  onTimeChange,
  showTimeFilter = true,
  dateLabel = 'Ngày:',
  timeLabel = 'Giờ:',
  statusOptions = null,
  statusFilter = 'all',
  onStatusChange = null,
  style,
}) {
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  const initialMonthDate = useMemo(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [selectedDate]);

  const [viewMonth, setViewMonth] = useState(initialMonthDate);

  const openCalendar = () => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      setViewMonth(new Date(y, m - 1, 1));
    } else {
      const now = new Date();
      setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setCalendarVisible(true);
  };

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Chuyển Chủ Nhật (0) thành 6, Thứ Hai (1) thành 0
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    return cells;
  }, [viewMonth]);

  const todayStr = getTodayStr();
  const hasStatusFilter =
    Array.isArray(statusOptions) && statusOptions.length > 0 && typeof onStatusChange === 'function';

  return (
    <View style={[styles.wrapper, style]}>
      {/* Hàng trên: Bộ lọc Trạng thái (Tất cả, Chờ duyệt, Đã xác nhận, Hoàn thành, Đã hủy) */}
      {hasStatusFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusScrollView}
          contentContainerStyle={styles.statusPillRow}
        >
          {statusOptions.map(([value, label]) => {
            const isSelected = statusFilter === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.statusPill, isSelected && styles.statusPillActive]}
                onPress={() => onStatusChange(value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusPillText, isSelected && styles.statusPillTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Hàng dưới: Cụm chọn Ngày và Giờ khám */}
      <View style={[styles.container, hasStatusFilter && styles.containerWithStatus]}>
        {/* Cụm chọn Ngày bằng Calendar */}
        <View style={styles.groupWrap}>
          {dateLabel ? <Text style={styles.label}>{dateLabel}</Text> : null}

          <TouchableOpacity
            style={[styles.pickerTrigger, styles.pickerTriggerActive]}
            onPress={openCalendar}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={COLORS.primaryDark}
            />
            <Text style={[styles.pickerTriggerText, styles.pickerTriggerTextActive]}>
              {formatDisplayDate(selectedDate)}
            </Text>
            <Ionicons
              name="caret-down-outline"
              size={12}
              color={COLORS.primaryDark}
            />
          </TouchableOpacity>

          {selectedDate && selectedDate !== todayStr && (
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => onDateChange && onDateChange(todayStr)}
            >
              <Text style={styles.quickBtnText}>Hôm nay</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cụm chọn Giờ */}
        {showTimeFilter && (
          <View style={styles.groupWrap}>
            {timeLabel ? <Text style={styles.label}>{timeLabel}</Text> : null}
            <TouchableOpacity
              style={[styles.pickerTrigger, selectedTime && styles.pickerTriggerActive]}
              onPress={() => setTimeModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={selectedTime ? COLORS.primaryDark : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.pickerTriggerText,
                  selectedTime && styles.pickerTriggerTextActive,
                ]}
              >
                {selectedTime ? `Khung ${selectedTime}` : 'Tất cả giờ'}
              </Text>
              <Ionicons
                name="caret-down-outline"
                size={12}
                color={selectedTime ? COLORS.primaryDark : COLORS.textSecondary}
              />
            </TouchableOpacity>

            {selectedTime !== '' && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => onTimeChange && onTimeChange('')}
              >
                <Ionicons name="close-circle" size={14} color={COLORS.textSecondary} />
                <Text style={styles.clearBtnText}>Xóa giờ</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* MODAL CALENDAR CHỌN NGÀY */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar" size={19} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Chọn ngày trên lịch</Text>
              </View>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={() => setCalendarVisible(false)}
              >
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Điều hướng Tháng / Năm */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                }
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                Tháng {viewMonth.getMonth() + 1} / {viewMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                }
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Hàng Thứ trong tuần */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((wd) => (
                <View key={wd} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Lưới Ngày trong tháng */}
            <View style={styles.daysGrid}>
              {calendarDays.map((cell, idx) => {
                if (!cell) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;

                return (
                  <TouchableOpacity
                    key={cell.dateStr}
                    style={[
                      styles.dayCell,
                      isToday && !isSelected && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      if (onDateChange) onDateChange(cell.dateStr);
                      setCalendarVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Nút chọn nhanh dưới chân lịch */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.footerPrimaryBtn}
                onPress={() => {
                  if (onDateChange) onDateChange(todayStr);
                  setCalendarVisible(false);
                }}
              >
                <Ionicons name="today-outline" size={16} color="#fff" />
                <Text style={styles.footerPrimaryBtnText}>Chọn Hôm nay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CHỌN GIỜ */}
      <Modal
        visible={timeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Lọc theo khung giờ</Text>
              </View>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={() => setTimeModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.allTimeOptionBtn,
                selectedTime === '' && styles.allTimeOptionBtnActive,
              ]}
              onPress={() => {
                if (onTimeChange) onTimeChange('');
                setTimeModalVisible(false);
              }}
            >
              <Ionicons
                name="infinite-outline"
                size={18}
                color={selectedTime === '' ? '#fff' : COLORS.text}
              />
              <Text
                style={[
                  styles.allTimeOptionText,
                  selectedTime === '' && styles.allTimeOptionTextActive,
                ]}
              >
                Tất cả khung giờ trong ngày
              </Text>
            </TouchableOpacity>

            <View style={styles.timeSlotsGrid}>
              {TIME_SLOTS.map((slot) => {
                const active = selectedTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeSlotChip, active && styles.timeSlotChipActive]}
                    onPress={() => {
                      if (onTimeChange) onTimeChange(slot);
                      setTimeModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={active ? '#fff' : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.timeSlotChipText,
                        active && styles.timeSlotChipTextActive,
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexShrink: 0,
  },
  statusScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  statusPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  statusPillTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  containerWithStatus: {
    marginTop: 10,
  },
  groupWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  dateControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 34,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerTriggerActive: {
    backgroundColor: '#F0FDFA',
    borderColor: COLORS.primary,
  },
  pickerTriggerText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
  pickerTriggerTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  quickBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
  },
  clearBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  dayTextToday: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '900',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerPrimaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  footerSecondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerSecondaryBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  allTimeOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  allTimeOptionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  allTimeOptionText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
  allTimeOptionTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeSlotChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeSlotChipText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
  timeSlotChipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
});
