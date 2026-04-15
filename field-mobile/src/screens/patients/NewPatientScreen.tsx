import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { createPatient, updatePatient, getPatientById, getPatientServerId } from '../../database/patients-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';
import { TriageLevel } from '../../types/database';

const TRIAGE_LEVELS: { key: TriageLevel; label: string; color: string; desc: string }[] = [
  { key: 'red', label: 'RED', color: '#dc2626', desc: 'Critical - Immediate' },
  { key: 'yellow', label: 'YELLOW', color: '#f59e0b', desc: 'Urgent - Delayed' },
  { key: 'green', label: 'GREEN', color: '#16a34a', desc: 'Minor - Walking wounded' },
  { key: 'black', label: 'BLACK', color: '#6b7280', desc: 'Deceased/Expectant' },
];

const GENDER_OPTIONS = [
  { key: 'male', label: 'Male', icon: 'male' },
  { key: 'female', label: 'Female', icon: 'female' },
  { key: 'other', label: 'Other', icon: 'person' },
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
  const { incidentId, patientId, isEdit } = route.params as { incidentId: string; patientId?: string; isEdit?: boolean };
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
  const [loading, setLoading] = useState(isEdit);
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  // Load existing patient if editing
  useEffect(() => {
    if (isEdit && patientId) {
      loadPatient(patientId);
    }
  }, [isEdit, patientId]);

  const loadPatient = async (id: string) => {
    try {
      const patient = await getPatientById(id);
      if (patient) {
        setTriage(patient.triage_priority || null);
        setFirstName(patient.first_name || '');
        setLastName(patient.last_name || '');
        setGender(patient.gender || '');
        setCondition(patient.chief_complaint || '');
        
        // Parse age from DOB
        if (patient.date_of_birth) {
          const birthYear = parseInt(patient.date_of_birth.split('-')[0]);
          const ageNum = new Date().getFullYear() - birthYear;
          if (ageNum >= 0 && ageNum <= 150) {
            setAge(ageNum.toString());
          }
        }
        
        // Parse observations and notes from medical_history
        if (patient.medical_history) {
          const obsMatch = patient.medical_history.match(/Initial Observations: (.+?)(?:\n\nNotes:|$)/s);
          const notesMatch = patient.medical_history.match(/Notes: (.+)$/s);
          if (obsMatch) {
            setObservations(obsMatch[1].split(', ').filter(Boolean));
          }
          if (notesMatch) {
            setNotes(notesMatch[1].trim());
          }
        }
      }
    } catch (err) {
      console.error('Failed to load patient:', err);
      Alert.alert('Error', 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const toggleObservation = (tag: string) => {
    setObservations(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Calculate date of birth from age (estimated)
  const calculateDOB = (ageValue: string): string | undefined => {
    const ageNum = parseInt(ageValue);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) return undefined;
    
    const now = new Date();
    const birthYear = now.getFullYear() - ageNum;
    // Set to Jan 1 of estimated birth year (approximation)
    return `${birthYear}-01-01`;
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
      // Build medical history from observations + notes
      const medicalHistoryParts: string[] = [];
      
      if (observations.length > 0) {
        medicalHistoryParts.push(`Initial Observations: ${observations.join(', ')}`);
      }
      
      if (notes.trim()) {
        medicalHistoryParts.push(`Notes: ${notes.trim()}`);
      }

      const medicalHistory = medicalHistoryParts.join('\n\n') || undefined;
      const dateOfBirth = calculateDOB(age);

      if (isEdit && patientId) {
        // Update existing patient
        await updatePatient(patientId, {
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          gender: (gender as any) || undefined,
          date_of_birth: dateOfBirth,
          triage_priority: triage,
          chief_complaint: condition.trim(),
          observations,
          medical_history: medicalHistory,
        });

        const patientServerId = await getPatientServerId(patientId);
        await addToSyncQueue('patients', patientId, 'UPDATE', {
          incident_id: incidentId,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          gender: gender || undefined,
          date_of_birth: dateOfBirth,
          triage_priority: triage,
          chief_complaint: condition.trim(),
          observations,
          medical_history: medicalHistory,
        }, { serverId: patientServerId || undefined });
      } else {
        // Create patient locally
        const patient = await createPatient({
          incident_id: incidentId,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          gender: (gender as any) || undefined,
          date_of_birth: dateOfBirth,
          triage_priority: triage,
          chief_complaint: condition.trim(),
          observations,
          medical_history: medicalHistory,
        });

        // Add to sync queue
        await addToSyncQueue('patients', patient.id, 'CREATE', {
          incident_id: incidentId,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          gender: gender || undefined,
          date_of_birth: dateOfBirth,
          triage_priority: triage,
          chief_complaint: condition.trim(),
          observations,
          medical_history: medicalHistory,
        });
      }

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

  const selectGender = (selectedGender: string) => {
    setGender(selectedGender);
    setGenderModalVisible(false);
  };

  const getSelectedGenderLabel = () => {
    const option = GENDER_OPTIONS.find(g => g.key === gender);
    return option ? option.label : 'Select Sex';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Patient' : 'Add Patient'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Patient' : 'Add Patient'}</Text>
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
                  triage === level.key && { 
                    borderColor: level.color, 
                    borderWidth: 2,
                    backgroundColor: `${level.color}15`,
                  },
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
                <Text style={styles.triageDesc}>{level.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Patient Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Patient Identity</Text>
          
          {/* Name Fields */}
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.flex1, styles.marginRight]}
              placeholder="First Name"
              placeholderTextColor="#6b7280"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, styles.flex1]}
              placeholder="Last Name"
              placeholderTextColor="#6b7280"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
          
          {/* Gender and Age Row */}
          <View style={styles.row}>
            {/* Gender Selector */}
            <TouchableOpacity
              style={[styles.select, styles.flex1, styles.marginRight]}
              onPress={() => setGenderModalVisible(true)}
            >
              <View style={styles.selectContent}>
                <MaterialIcons 
                  name={gender ? 'person' : 'help-outline'} 
                  size={18} 
                  color={gender ? '#fff' : '#6b7280'} 
                />
                <Text style={gender ? styles.selectValue : styles.selectPlaceholder}>
                  {getSelectedGenderLabel()}
                </Text>
              </View>
              <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
            </TouchableOpacity>
            
            {/* Age Input */}
            <View style={[styles.inputContainer, styles.flex1]}>
              <TextInput
                style={styles.ageInput}
                placeholder="Age"
                placeholderTextColor="#6b7280"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.ageUnit}>yrs</Text>
            </View>
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
          <Text style={styles.sectionLabel}>Initial Observations</Text>
          <View style={styles.tagsContainer}>
            {OBSERVATION_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  observations.includes(tag) && styles.tagActive,
                  tag === 'Unresponsive' && !observations.includes(tag) && styles.tagWarning,
                ]}
                onPress={() => toggleObservation(tag)}
              >
                {observations.includes(tag) && (
                  <MaterialIcons name="check" size={14} color="#fff" style={styles.tagIcon} />
                )}
                <Text
                  style={[
                    styles.tagText,
                    observations.includes(tag) && styles.tagTextActive,
                    tag === 'Unresponsive' && !observations.includes(tag) && styles.tagTextWarning,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Notes */}
          <View style={styles.notesContainer}>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Additional notes from initial assessment..."
              placeholderTextColor="#6b7280"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'SAVING...' : (isEdit ? 'UPDATE PATIENT' : 'SAVE PATIENT')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Gender Selection Modal */}
      <Modal
        visible={genderModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGenderModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGenderModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Sex</Text>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalOption,
                  gender === option.key && styles.modalOptionSelected,
                ]}
                onPress={() => selectGender(option.key)}
              >
                <MaterialIcons 
                  name={option.icon as any} 
                  size={24} 
                  color={gender === option.key ? '#dc2626' : '#9ca3af'} 
                />
                <Text style={[
                  styles.modalOptionText,
                  gender === option.key && styles.modalOptionTextSelected,
                ]}>
                  {option.label}
                </Text>
                {gender === option.key && (
                  <MaterialIcons name="check" size={20} color="#dc2626" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
    padding: 12,
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
  triageDesc: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
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
  nameRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  marginRight: {
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  ageInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 16,
  },
  ageUnit: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 4,
  },
  select: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  tagActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  tagWarning: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: '#dc2626',
  },
  tagIcon: {
    marginRight: 2,
  },
  tagText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  tagTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tagTextWarning: {
    color: '#fca5a5',
  },
  notesContainer: {
    marginTop: 8,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  modalOptionText: {
    color: '#9ca3af',
    fontSize: 16,
    flex: 1,
  },
  modalOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
