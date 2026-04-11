import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { v4 as uuidv4 } from 'uuid';

import { createIncident } from '../../database/incidents-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';
import { IncidentStatus, PriorityLevel } from '../../types/database';

const SITUATION_TYPES = [
  { icon: 'car-crash', label: 'Vehicle Accident', value: 'Vehicle Accident' },
  { icon: 'personal-injury', label: 'Injury / Trauma', value: 'Injury / Trauma' },
  { icon: 'ecg-heart', label: 'Medical Emergency', value: 'Medical Emergency' },
  { icon: 'local-fire-department', label: 'Fire / Burns', value: 'Fire / Burns' },
];

export function NewIncidentScreen() {
  const navigation = useNavigation();
  const [situation, setSituation] = useState<string>('');
  const [address, setAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [casualties, setCasualties] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  
  const { sync } = useSyncStore();

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setAddress(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    } finally {
      setLocationLoading(false);
    }
  };

  const adjustCasualty = (type: keyof typeof casualties, delta: number) => {
    setCasualties(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
  };

  const handleCreate = async () => {
    if (!situation) {
      Alert.alert('Error', 'Please select a situation type');
      return;
    }
    if (!address) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    setCreating(true);
    try {
      // Determine priority based on casualty count
      let priority: PriorityLevel = 'non_urgent';
      if (casualties.red > 0) priority = 'critical';
      else if (casualties.yellow > 0) priority = 'urgent';

      // Create incident locally
      const incident = await createIncident({
        incident_number: `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        address,
        status: 'on_scene' as IncidentStatus,
        priority,
        chief_complaint: situation,
        scene_description: notes,
        local_id: uuidv4(),
        device_id: 'mobile-device',
      });

      // Add to sync queue
      await addToSyncQueue('incidents', incident.id, 'CREATE', {
        incident_number: incident.incident_number,
        address,
        status: 'on_scene',
        priority,
        chief_complaint: situation,
        scene_description: notes,
        local_id: incident.local_id,
      });

      // Trigger immediate sync (fire and forget - don't block navigation)
      sync().then(result => {
        if (result.success) {
          console.log('Auto-sync completed successfully');
        } else {
          console.log('Auto-sync had errors:', result.errors);
        }
      }).catch(err => {
        console.log('Auto-sync failed:', err.message);
      });

      // Reset navigation stack to Main (Home) and navigate to IncidentDetail
      // This ensures back button from IncidentDetail goes to Home, not the form
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Main' as never },
          { name: 'IncidentDetail' as never, params: { incidentId: incident.id } },
        ],
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create incident');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log New Incident</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Situation Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. Situation Type *</Text>
          <View style={styles.situationGrid}>
            {SITUATION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.situationCard,
                  situation === type.value && styles.situationCardActive,
                ]}
                onPress={() => setSituation(type.value)}
              >
                <MaterialIcons
                  name={type.icon}
                  size={28}
                  color={situation === type.value ? '#dc2626' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.situationLabel,
                    situation === type.value && styles.situationLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. Location *</Text>
          <View style={styles.locationInput}>
            <TextInput
              style={styles.input}
              placeholder="Enter address or landmark"
              placeholderTextColor="#6b7280"
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              <MaterialIcons
                name={locationLoading ? 'location-searching' : 'my-location'}
                size={24}
                color="#dc2626"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Casualties */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>3. Casualties</Text>
          <View style={styles.casualtiesGrid}>
            {[
              { key: 'red', label: 'RED', color: '#dc2626' },
              { key: 'yellow', label: 'YELLOW', color: '#f59e0b' },
              { key: 'green', label: 'GREEN', color: '#16a34a' },
              { key: 'black', label: 'BLACK', color: '#6b7280' },
            ].map((item) => (
              <View key={item.key} style={styles.casualtyCard}>
                <Text style={[styles.casualtyLabel, { color: item.color }]}>
                  {item.label}
                </Text>
                <View style={styles.casualtyControls}>
                  <TouchableOpacity
                    style={styles.casualtyButton}
                    onPress={() => adjustCasualty(item.key as any, -1)}
                  >
                    <Text style={styles.casualtyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.casualtyCount}>
                    {casualties[item.key as keyof typeof casualties]}
                  </Text>
                  <TouchableOpacity
                    style={styles.casualtyButton}
                    onPress={() => adjustCasualty(item.key as any, 1)}
                  >
                    <Text style={styles.casualtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scene Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Describe what you found on arrival..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={creating}
        >
          <Text style={styles.createButtonText}>
            {creating ? 'CREATING...' : 'CREATE CASE'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  situationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  situationCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  situationCardActive: {
    borderColor: '#dc2626',
  },
  situationLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  situationLabelActive: {
    color: '#dc2626',
  },
  locationInput: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  locationButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  casualtiesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  casualtyCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  casualtyLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  casualtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  casualtyButton: {
    width: 28,
    height: 28,
    backgroundColor: '#0f0f0f',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casualtyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  casualtyCount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#dc2626',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
