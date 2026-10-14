import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { createDocumentApi, deleteDocumentApi, listDocumentsApi, updateDocumentApi } from '../../api/documentApi';

const SPECIES_OPTIONS = [
  ['all', 'Tất cả loài'],
  ['dog', 'Chó'],
  ['cat', 'Mèo'],
  ['other', 'Khác'],
];

const emptyForm = { title: '', species: 'all', category: '', content: '', is_active: true };

export default function KnowledgeBaseScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await listDocumentsApi();
      setDocuments(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEditForm = (doc) => {
    setEditingId(doc.id);
    setForm({
      title: doc.title,
      species: doc.species,
      category: doc.category || '',
      content: doc.content,
      is_active: !!doc.is_active,
    });
    setFormVisible(true);
  };

  const saveDocument = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề và nội dung tài liệu.');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await updateDocumentApi(editingId, form);
      } else {
        await createDocumentApi(form);
      }
      setFormVisible(false);
      await loadDocuments();
      Alert.alert('Thành công', 'Tài liệu đã được lưu vào cơ sở tri thức AI.');
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể lưu tài liệu');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (doc) => {
    Alert.alert('Xóa tài liệu', `Bạn có chắc muốn xóa "${doc.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteDocument(doc.id) },
    ]);
  };

  const deleteDocument = async (id) => {
    try {
      await deleteDocumentApi(id);
      await loadDocuments();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể xóa tài liệu');
    }
  };

  const speciesLabel = (value) => SPECIES_OPTIONS.find(([v]) => v === value)?.[1] || value;

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>CƠ SỞ TRI THỨC AI</Text>
            <Text style={styles.title}>Tài liệu Y Khoa RAG 📚</Text>
            <Text style={styles.subtitle}>
              Cung cấp kiến thức y tế chuẩn xác để AI tư vấn bám sát tài liệu thực tế của bệnh viện.
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreateForm}>
            <Text style={styles.addButtonText}>+ Thêm tài liệu</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : documents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.empty}>Chưa có tài liệu nào trong cơ sở tri thức.</Text>
            <TouchableOpacity style={[styles.addButton, { marginTop: 12 }]} onPress={openCreateForm}>
              <Text style={styles.addButtonText}>Tạo tài liệu đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.docGrid, isTabletOrDesktop && styles.docGridDesktop]}>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, isTabletOrDesktop && styles.docCardDesktop]}
                onPress={() => openEditForm(doc)}
                activeOpacity={0.8}
              >
                <View style={styles.docTop}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: doc.is_active ? '#DCFCE7' : '#F1F5F9' }]}>
                    <Text style={[styles.statusBadgeText, { color: doc.is_active ? '#16A34A' : '#64748B' }]}>
                      {doc.is_active ? 'Đang dùng' : 'Tạm ẩn'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>🐾 {speciesLabel(doc.species)}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>🏷️ {doc.category || 'Chưa phân loại'}</Text>
                  </View>
                </View>

                <Text style={styles.docContent} numberOfLines={3}>{doc.content}</Text>

                <View style={styles.docFooter}>
                  <Text style={styles.editHintText}>Chạm để chỉnh sửa ✍️</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      confirmDelete(doc);
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Thêm / Sửa tài liệu */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? 'Cập nhật tài liệu' : 'Thêm tài liệu RAG mới'}</Text>
                <Text style={styles.modalSubtitle}>Kiến thức sẽ được lập chỉ mục vector cho AI</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setFormVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Áp dụng cho loài</Text>
              <View style={styles.typeRow}>
                {SPECIES_OPTIONS.map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setForm({ ...form, species: value })}
                    style={[styles.typeButton, form.species === value && styles.typeButtonSelected]}
                  >
                    <Text style={form.species === value ? styles.typeTextSelected : styles.typeText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Field
                label="Tiêu đề tài liệu"
                value={form.title}
                onChangeText={(title) => setForm({ ...form, title })}
                placeholder="VD: Triệu chứng và phác đồ sơ cứu Viêm ruột Parvo"
              />
              <Field
                label="Chuyên khoa / Danh mục"
                value={form.category}
                onChangeText={(category) => setForm({ ...form, category })}
                placeholder="VD: Tiêu hóa, Da liễu, Hô hấp..."
              />
              <Field
                label="Nội dung tài liệu y khoa"
                value={form.content}
                onChangeText={(content) => setForm({ ...form, content })}
                placeholder="Nhập thông tin chuyên môn, nguyên nhân, biểu hiện, hướng dẫn sơ cứu..."
                multiline
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.switchLabel}>Kích hoạt trong tư vấn AI</Text>
                  <Text style={styles.switchSub}>Bật để AI sử dụng tài liệu này khi trả lời khách</Text>
                </View>
                <Switch
                  value={form.is_active}
                  onValueChange={(is_active) => setForm({ ...form, is_active })}
                  trackColor={{ true: COLORS.primary }}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={saveDocument} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{editingId ? 'Lưu thay đổi' : 'Thêm vào kho tri thức'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, multiline, placeholder, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 260,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  empty: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  docGrid: {
    paddingHorizontal: 16,
    gap: 14,
  },
  docGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  docCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  docCardDesktop: {
    width: '48.8%',
  },
  docTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  docTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaBadge: {
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  docContent: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  docFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  editHintText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  modalCentered: {
    maxWidth: 620,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalScroll: {
    maxHeight: 520,
  },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: COLORS.background,
  },
  typeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeTextSelected: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  switchSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
