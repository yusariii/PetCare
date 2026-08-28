import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getMyPetsApi } from '../../api/petApi';

export default function HomeScreen({ navigation }) {
    const [pets, setPets] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPets = async () => {
        try {
            const res = await getMyPetsApi();
            if (res.data.success) setPets(res.data.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { fetchPets(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPets();
        setRefreshing(false);
    };

    return (
        <ResponsiveContainer style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.welcome}>Xin chào, Sen! 🌿</Text>
                <Text style={styles.sub}>Danh sách bé cưng của bạn</Text>
            </View>

            <FlatList
                data={pets}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <View style={styles.petCard}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.species === 'dog' ? '🐶' : '🐱'}</Text>
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.petName}>{item.name}</Text>
                            <Text style={styles.petBreed}>{item.breed || 'Chưa cập nhật giống'}</Text>
                            <Text style={styles.petMeta}>⚖️ {item.weight_kg ? `${item.weight_kg} kg` : 'N/A'}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={{ color: COLORS.textSecondary }}>Bạn chưa thêm thú cưng nào.</Text>
                    </View>
                }
            />
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    header: { marginBottom: 16, marginTop: 8 },
    welcome: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryDark },
    sub: { fontSize: 14, color: COLORS.textSecondary },
    petCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { fontSize: 26 },
    info: { flex: 1 },
    petName: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    petBreed: { fontSize: 14, color: COLORS.textSecondary, marginVertical: 2 },
    petMeta: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
    empty: { alignItems: 'center', marginTop: 40 },
});