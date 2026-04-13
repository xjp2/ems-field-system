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

import { createVital } from '../../database/vitals-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';

export function AddVitalScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { patientId, incidentId } = route.params as { patientId: string; incidentId: string };
  const { sync } = useSyncStore();

  // Vital sign states
  const [heartRate, setHeartRate] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [temperature, setTemperature] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  
  // GCS states
  const [gcsEye, setGcsEye] = useState('');
  const [gcsVerbal, setGcsVerbal] = useState('');
  const [gcsMotor, setGcsMotor] = useState('');
  
  // Pain and notes
  const [painScore, setPainScore] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Calculate total GCS
  const calculateGCS = (): number | undefined => {
    const eye = parseInt(gcsEye) || 0;
    const verbal = parseInt(gcsVerbal) || 0;
    const motor = parseInt(gcsMotor) || 0;
    const total = eye + verbal + motor;
    return total > 0 ? total : undefined;
  };

  const handleSave = async () => {
    // Check if at least one vital is entered
    const hasAnyVital = heartRate || bpSystolic || respiratoryRate || 
                       oxygenSaturation || temperature || bloodGlucose ||
                       gcsEye || gcsVerbal || gcsMotor || painScore;
    
    if (!hasAnyVital) {
      Alert.alert('Error', 'Please enter at least one vital sign');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const gcsTotal = calculateGCS();

      // Create vital locally
      const vital = await createVital({
        patient_id: patientId,
        recorded_at: now,
        heart_rate: heartRate ? parseInt(heartRate) : undefined,
        blood_pressure_systolic: bpSystolic ? parseInt(bpSystolic) : undefined,
        blood_pressure_diastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
        respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
        oxygen_saturation: oxygenSaturation ? parseFloat(oxygenSaturation) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        blood_glucose: bloodGlucose ? parseInt(bloodGlucose) : undefined,
        gcs_total: gcsTotal,
        gcs_eye: gcsEye ? parseInt(gcsEye) : undefined,
        gcs_verbal: gcsVerbal ? parseInt(gcsVerbal) : undefined,
        gcs_motor: gcsMotor ? parseInt(gcsMotor) : undefined,
        pain_score: painScore ? parseInt(painScore) : undefined,
        notes: notes.trim() || undefined,
      });

      // Add to sync queue
      await addToSyncQueue('vitals', vital.id, 'CREATE', {
        patient_id: patientId,
        recorded_at: now,
        heart_rate: heartRate ? parseInt(heartRate) : undefined,
        blood_pressure_systolic: bpSystolic ? parseInt(bpSystolic) : undefined,
        blood_pressure_diastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
        respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
        oxygen_saturation: oxygenSaturation ? parseFloat(oxygenSaturation) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        blood_glucose: bloodGlucose ? parseInt(bloodGlucose) : undefined,
        gcs_total: gcsTotal,
        gcs_eye: gcsEye ? parseInt(gcsEye) : undefined,
        gcs_verbal: gcsVerbal ? parseInt(gcsVerbal) : undefined,
        gcs_motor: gcsMotor ? parseInt(gcsMotor) : undefined,
        pain_score: painScore ? parseInt(painScore) : undefined,
        notes: notes.trim() || undefined,
      });

      // Trigger sync
      sync().catch(err => console.log('Vital sync failed:', err.message));

      // Navigate back
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save vitals');
    } finally {
      setSaving(false);
    }
  };

  const gcsTotal = calculateGCS();
  const gcsSeverity = gcsTotal && gcsTotal < 9 ? 'Critical' : gcsTotal && gcsTotal < 13 ? 'Moderate' : gcsTotal && gcsTotal >= 13 ? 'Minor' : '';
  const gcsColor = gcsTotal && gcsTotal < 9 ? '#dc2626' : gcsTotal && gcsTotal < 13 ? '#f59e0b' : gcsTotal && gcsTotal >= 13 ? '#16a34a' : '#6b7280';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Vitals</Text>
        <TouchableOpacity 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
            {saving ? 'SAVING...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Primary Vitals */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Cardiovascular</Text>
            
            {/* Heart Rate */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="favorite" size={24} color="#dc2626" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Heart Rate</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={heartRate}
                    onChangeText={setHeartRate}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unit}>BPM</Text>
                </View>
              </View>
            </View>

            {/* Blood Pressure */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="speed" size={24} color="#dc2626" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Blood Pressure</Text>
                <View style={styles.bpInput}>
                  <TextInput
                    style={[styles.vitalInputField, styles.bpField]}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={bpSystolic}
                    onChangeText={setBpSystolic}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.bpSeparator}>/</Text>
                  <TextInput
                    style={[styles.vitalInputField, styles.bpField]}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={bpDiastolic}
                    onChangeText={setBpDiastolic}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unit}>mmHg</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Respiratory */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Respiratory</Text>
            
            {/* Respiratory Rate */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="air" size={24} color="#3b82f6" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Respiratory Rate</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={respiratoryRate}
                    onChangeText={setRespiratoryRate}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.unit}>rpm</Text>
                </View>
              </View>
            </View>

            {/* SpO2 */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="water-drop" size={24} color="#3b82f6" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Oxygen Saturation</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={oxygenSaturation}
                    onChangeText={setOxygenSaturation}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                  <Text style={styles.unit}>%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Other Vitals */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Other</Text>
            
            {/* Temperature */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="thermostat" size={24} color="#f59e0b" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Temperature</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={temperature}
                    onChangeText={setTemperature}
                    keyboardType="decimal-pad"
                    maxLength={4}
                  />
                  <Text style={styles.unit}>°C</Text>
                </View>
              </View>
            </View>

            {/* Blood Glucose */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="water" size={24} color="#f59e0b" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Blood Glucose</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={bloodGlucose}
                    onChangeText={setBloodGlucose}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unit}>mg/dL</Text>
                </View>
              </View>
            </View>

            {/* Pain Score */}
            <View style={styles.vitalRow}>
              <View style={styles.vitalIcon}>
                <MaterialIcons name="sentiment-dissatisfied" size={24} color="#ec4899" />
              </View>
              <View style={styles.vitalInput}>
                <Text style={styles.vitalLabel}>Pain Score (0-10)</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={styles.vitalInputField}
                    placeholder="--"
                    placeholderTextColor="#6b7280"
                    value={painScore}
                    onChangeText={setPainScore}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.unit}>/10</Text>
                </View>
              </View>
            </View>
          </View>

          {/* GCS Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Glasgow Coma Scale</Text>
            
            <View style={styles.gcsRow}>
              <View style={styles.gcsItem}>
                <Text style={styles.gcsLabel}>Eye</Text>
                <TextInput
                  style={styles.gcsInput}
                  placeholder="1-4"
                  placeholderTextColor="#6b7280"
                  value={gcsEye}
                  onChangeText={setGcsEye}
                  keyboardType="number-pad"
                  maxLength={1}
                />
              </View>
              <View style={styles.gcsItem}>
                <Text style={styles.gcsLabel}>Verbal</Text>
                <TextInput
                  style={styles.gcsInput}
                  placeholder="1-5"
                  placeholderTextColor="#6b7280"
                  value={gcsVerbal}
                  onChangeText={setGcsVerbal}
                  keyboardType="number-pad"
                  maxLength={1}
                />
              </View>
              <View style={styles.gcsItem}>
                <Text style={styles.gcsLabel}>Motor</Text>
                <TextInput
                  style={styles.gcsInput}
                  placeholder="1-6"
                  placeholderTextColor="#6b7280"
                  value={gcsMotor}
                  onChangeText={setGcsMotor}
                  keyboardType="number-pad"
                  maxLength={1}
                />
              </View>
            </View>

            {gcsTotal && (
              <View style={[styles.gcsResult, { backgroundColor: `${gcsColor}20` }]}>
                <Text style={[styles.gcsTotal, { color: gcsColor }]}>{gcsTotal}</Text>
                <Text style={[styles.gcsSeverity, { color: gcsColor }]}>{gcsSeverity}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Additional notes..."
              placeholderTextColor="#6b7280"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
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
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  vitalIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vitalInput: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalInputField: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    minWidth: 80,
    padding: 0,
  },
  unit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  bpInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bpField: {
    minWidth: 60,
    fontSize: 24,
  },
  bpSeparator: {
    fontSize: 24,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  gcsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gcsItem: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  gcsLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  gcsInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    minWidth: 60,
  },
  gcsResult: {
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  gcsTotal: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  gcsSeverity: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 32,
  },
});
