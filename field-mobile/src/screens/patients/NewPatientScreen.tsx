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
import { useNavigation, useRoute } from '@react-navigation/native';

import { createPatient } from '../../database/patients-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';
import { TriageLevel, Patient } from '../../types/database';

const TRIAGE_LEVELS: { key: TriageLevel; label: string; color: string }[] = [
  { key: 'red', label: 'RED', color: '#dc2626' },
  { key: 'yellow', label: 'YELLOW', color: '#f59e0b' },
  { key: 'green', label: 'GREEN', color: '#16a34a' },
  { key: 'black', label: 'BLACK', color: '#6b7280' },
];

const OBSERVATION_TAGS = [
  'Conscious & Alert',
  'Airway Clear',
  'Breathing Normal',
  'Circulation Stable',
  'Responsive to Pain',
  'Unresponsive',
  'Bleeding Controlled',
  'O2 Administered',
];

export function NewPatientScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { incidentId } = route.params as { incidentId: string };
  const { sync } = useSyncStore();

  const [triage, setTriage] = useState<TriageLevel | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('');
  const [observations, setObservations] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleObservation = (tag: string) => {
    setObservations(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!triage) {
      Alert.alert('Error', 'Please select a triage level');
      return;
    }
    if (!condition) {
      Alert.alert('Error', 'Please enter the primary condition');
      return;
    }

    setSaving(true);
    try {
      // Create patient locally
      const patient = await createPatient({
        incident_id: incidentId,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        gender: gender as any || undefined,
        triage_priority: triage,
        chief_complaint: condition,
        observations,
      });

      // Add to sync queue
      await addToSyncQueue('patients', patient.id, 'CREATE', {
        incident_id: incidentId,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        gender: gender || undefined,
        triage_priority: triage,
        chief_complaint: condition,
        observations,
      });

      // Trigger immediate sync (fire and forget)
      sync().catch(err => console.log('Patient auto-sync failed:', err.message));

      // Navigate back
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Patient</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Triage Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Triage Level *</Text>
          <View style={styles.triageGrid}>
            {TRIAGE_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.triageCard,
                  triage === level.key && { borderColor: level.color, borderWidth: 2 },
                ]}
                onPress={() => setTriage(level.key)}
              >
                <View
                  style={[
                    styles.triageCircle,
                    { backgroundColor: level.color },
                  ]}
                />
                <Text
                  style={[
                    styles.triageLabel,
                    triage === level.key && { color: level.color },
                  ]}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Patient Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Patient Identity</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name (or Unknown)"
            placeholderTextColor="#6b7280"
            value={firstName}
            onChangeText={setFirstName}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.select, { flex: 1, marginRight: 8 }]}
              onPress={() => {
                // Simple toggle for demo
                setGender(g === 'Male' ? 'Female' : 'Male');
              }}
            >
              <Text style={gender ? styles.selectValue : styles.selectPlaceholder}>
                {gender || 'Sex'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Age"
              placeholderTextColor="#6b7280"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Primary Condition */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Primary Condition *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Head trauma, Chest pain, Fracture..."
            placeholderTextColor="#6b7280"
            value={condition}
            onChangeText={setCondition}
          />
        </View>

        {/* Field Observations */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Field Observations</Text>
          <View style={styles.tagsContainer}>
            {OBSERVATION_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  observations.includes(tag) && styles.tagActive,
                  tag === 'Unresponsive' && styles.tagWarning,
                ]}
                onPress={() => toggleObservation(tag)}
              >
                <Text
                  style={[
                    styles.tagText,
                    observations.includes(tag) && styles.tagTextActive,
                    tag === 'Unresponsive' && styles.tagTextWarning,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.notesContainer}>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="What you observed on initial assessment..."
              placeholderTextColor="#6b7280"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.micButton}>
              <MaterialIcons name="mic" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'SAVING...' : 'SAVE PATIENT'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const g = 'Male';

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
  triageGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  triageCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  triageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  triageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  select: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
  },
  selectValue: {
    color: '#fff',
    fontSize: 16,
  },
  selectPlaceholder: {
    color: '#6b7280',
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagActive: {
    backgroundColor: '#374151',
    borderColor: '#6b7280',
  },
  tagWarning: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: '#991b1b',
  },
  tagText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  tagTextActive: {
    color: '#fff',
  },
  tagTextWarning: {
    color: '#fca5a5',
  },
  notesContainer: {
    position: 'relative',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingRight: 48,
  },
  micButton: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    width: 36,
    height: 36,
    backgroundColor: '#374151',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#dc2626',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
