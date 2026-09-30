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
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { createDocumentApi, deleteDocumentApi, listDocumentsApi, updateDocumentApi } from '../../api/documentApi';

const SPECIES_OPTIONS = [
  ['all', 'Tất cả loài'],
  ['dog', 'Chó'],
  ['cat', 'Mèo'],
  ['other', 'Khác'],
];

const emptyForm = { title: '', species: 'all', category: '', content: '', is_active: true };

export default function KnowledgeBaseScreen() {
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CƠ SỞ TRI THỨC AI</Text>
          <Text style={styles.title}>Tài liệu tham khảo RAG</Text>
          <Text style={styles.subtitle}>Nội dung do bác sĩ cung cấp để AI chẩn đoán bám sát thực tế, không bịa đặt.</Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={openCreateForm}>
          <Text style={styles.addButtonText}>+ Thêm tài liệu mới</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : documents.length === 0 ? (
          <Text style={styles.empty}>Chưa có tài liệu nào trong cơ sở tri thức.</Text>
        ) : documents.map((doc) => (
          <TouchableOpacity key={doc.id} style={styles.docCard} onPress={() => openEditForm(doc)}>
            <View style={styles.docTop}>
              <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
              <Text style={[styles.docStatus, { color: doc.is_active ? COLORS.success : COLORS.textSecondary }]}>
                {doc.is_active ? 'Đang dùng' : 'Tạm ẩn'}
              </Text>
            </View>
            <Text style={styles.docMeta}>{speciesLabel(doc.species)} · {doc.category || 'Chưa phân loại'}</Text>
            <Text style={styles.docContent} numberOfLines={2}>{doc.content}</Text>
            <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(doc)}>
              <Text style={styles.deleteButtonText}>Xóa</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Sửa tài liệu' : 'Thêm tài liệu'}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}><Text style={styles.close}>X</Text></TouchableOpacity>
            </View>
            <ScrollView>
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

              <Field label="Tiêu đề" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
              <Field label="Danh mục (vd: Tiêu hóa, Da liễu...)" value={form.category} onChangeText={(category) => setForm({ ...form, category })} />
              <Field
                label="Nội dung tài liệu (kiến thức y khoa dùng để tư vấn)"
                value={form.content}
                onChangeText={(content) => setForm({ ...form, content })}
                multiline
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Kích hoạt sử dụng trong tư vấn AI</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(is_active) => setForm({ ...form, is_active })}
                  trackColor={{ true: COLORS.primary }}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={saveDocument} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Lưu tài liệu</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multiline]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, marginTop: 6 },
  addButton: { marginHorizontal: 16, marginBottom: 14, backgroundColor: COLORS.primary, padding: 13, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '800' },
  loader: { marginTop: 30 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 30 },
  docCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  docTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16, flex: 1, marginRight: 8 },
  docStatus: { fontWeight: '700', fontSize: 12 },
  docMeta: { color: COLORS.textSecondary, marginTop: 6, fontSize: 12 },
  docContent: { color: COLORS.textSecondary, marginTop: 8 },
  deleteButton: { alignSelf: 'flex-end', marginTop: 10 },
  deleteButtonText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' },
  close: { color: COLORS.textSecondary, fontWeight: '800', padding: 8 },
  fieldLabel: { color: COLORS.text, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, padding: 11, color: COLORS.text, backgroundColor: COLORS.background },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8 },
  typeButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { color: COLORS.textSecondary, fontSize: 12 },
  typeTextSelected: { color: '#fff', fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  saveText: { color: '#fff', fontWeight: '800' },
});
