import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { createIntervention } from '../../database/interventions-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';
import { InterventionType } from '../../types/database';

const INTERVENTION_TYPES: { key: InterventionType; label: string; icon: string }[] = [
  { key: 'medication', label: 'Medication', icon: 'medication' },
  { key: 'procedure', label: 'Procedure', icon: 'medical-services' },
  { key: 'airway', label: 'Airway', icon: 'airline-seat-flat' },
  { key: 'iv_access', label: 'IV Access', icon: 'opacity' },
  { key: 'monitoring', label: 'Monitoring', icon: 'monitor' },
  { key: 'other', label: 'Other', icon: 'more-horiz' },
];

const COMMON_MEDICATIONS = [
  'Oxygen',
  'Adrenaline',
  'Morphine',
  'Saline',
  'Glucose',
  'Aspirin',
  'Nitroglycerin',
];

const COMMON_PROCEDURES = [
  'CPR',
  'Defibrillation',
  'Intubation',
  'Wound Dressing',
  'Splinting',
  'Spinal Immobilization',
];

// Quick select options
const ROUTE_OPTIONS = ['IV', 'IM', 'SC', 'Oral', 'Inhalation', 'Topical', 'Sublingual', 'Rectal'];
const RESPONSE_OPTIONS = ['Improved', 'No Change', 'Deteriorated', 'Resolved', 'Adverse Reaction'];

export function AddInterventionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { patientId, incidentId } = route.params as { patientId: string; incidentId: string };
  const { sync } = useSyncStore();

  const [selectedType, setSelectedType] = useState<InterventionType | null>(null);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [adminRoute, setAdminRoute] = useState('');
  const [response, setResponse] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Check if dosage is needed (mainly for medications)
  const needsDosage = selectedType === 'medication' || selectedType === 'iv_access';

  const handleSave = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select intervention type');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter intervention name');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Create intervention locally
      const intervention = await createIntervention({
        patient_id: patientId,
        performed_at: now,
        type: selectedType,
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        route: adminRoute || undefined,
        response: response || undefined,
        notes: notes.trim() || undefined,
      });

      // Add to sync queue
      await addToSyncQueue('interventions', intervention.id, 'CREATE', {
        patient_id: patientId,
        performed_at: now,
        type: selectedType,
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        route: adminRoute || undefined,
        response: response || undefined,
        notes: notes.trim() || undefined,
      });

      // Trigger sync
      sync().catch(err => console.log('Intervention sync failed:', err.message));

      // Navigate back
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save intervention');
    } finally {
      setSaving(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
  };

  const getSuggestions = () => {
    if (selectedType === 'medication') return COMMON_MEDICATIONS;
    if (selectedType === 'procedure') return COMMON_PROCEDURES;
    return [];
  };

  const suggestions = getSuggestions();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Treatment</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Intervention Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type *</Text>
            <View style={styles.typeGrid}>
              {INTERVENTION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    selectedType === type.key && styles.typeCardActive,
                  ]}
                  onPress={() => {
                    setSelectedType(type.key);
                    setShowSuggestions(true);
                  }}
                >
                  <MaterialIcons
                    name={type.icon as any}
                    size={28}
                    color={selectedType === type.key ? '#dc2626' : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      selectedType === type.key && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsLabel}>Common {selectedType}s</Text>
                <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                  <MaterialIcons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.suggestionsList}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestionChip}
                    onPress={() => selectSuggestion(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Intervention Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Oxygen, CPR, Wound dressing..."
              placeholderTextColor="#6b7280"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Dosage - Only for medications/IV */}
          {needsDosage && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Dosage</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 15L/min, 10mg, 500ml..."
                placeholderTextColor="#6b7280"
                value={dosage}
                onChangeText={setDosage}
              />
            </View>
          )}

          {/* Route - Quick Select */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Route</Text>
            <View style={styles.quickSelectGrid}>
              {ROUTE_OPTIONS.map((routeOption) => (
                <TouchableOpacity
                  key={routeOption}
                  style={[
                    styles.quickSelectChip,
                    adminRoute === routeOption && styles.quickSelectChipActive,
                  ]}
                  onPress={() => setAdminRoute(routeOption)}
                >
                  <Text
                    style={[
                      styles.quickSelectText,
                      adminRoute === routeOption && styles.quickSelectTextActive,
                    ]}
                  >
                    {routeOption}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {adminRoute && (
              <TouchableOpacity 
                style={styles.clearSelection}
                onPress={() => setAdminRoute('')}
              >
                <Text style={styles.clearSelectionText}>Clear selection</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Patient Response - Quick Select */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Patient Response</Text>
            <View style={styles.quickSelectList}>
              {RESPONSE_OPTIONS.map((responseOption) => (
                <TouchableOpacity
                  key={responseOption}
                  style={[
                    styles.responseChip,
                    response === responseOption && styles.responseChipActive,
                  ]}
                  onPress={() => setResponse(responseOption)}
                >
                  <MaterialIcons
                    name={
                      responseOption === 'Improved'
                        ? 'trending-up'
                        : responseOption === 'Deteriorated'
                        ? 'trending-down'
                        : responseOption === 'Resolved'
                        ? 'check-circle'
                        : responseOption === 'Adverse Reaction'
                        ? 'warning'
                        : 'remove'
                    }
                    size={18}
                    color={response === responseOption ? '#fff' : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.responseText,
                      response === responseOption && styles.responseTextActive,
                    ]}
                  >
                    {responseOption}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {response && (
              <TouchableOpacity 
                style={styles.clearSelection}
                onPress={() => setResponse('')}
              >
                <Text style={styles.clearSelectionText}>Clear selection</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any other details..."
              placeholderTextColor="#6b7280"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>

        </ScrollView>

        {/* Bottom Save Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'SAVING...' : 'SAVE TREATMENT'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  saveText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveTextDisabled: {
    opacity: 0.5,
  },
  keyboardView: {
    flex: 1,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    width: '31%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  typeLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  suggestionsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionsLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 13,
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
  // Quick Select Styles
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectChip: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickSelectChipActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  quickSelectText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  quickSelectTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  clearSelection: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  clearSelectionText: {
    color: '#6b7280',
    fontSize: 13,
  },
  // Response Styles
  quickSelectList: {
    gap: 8,
  },
  responseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  responseChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  responseText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  responseTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  // Bottom Bar Styles
  bottomBar: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
