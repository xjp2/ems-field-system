import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { Patient, Intervention, Vital } from '../../types/database';
import { getPatientById } from '../../database/patients-db';
import { getVitalsByPatient } from '../../database/vitals-db';
import { getInterventionsByPatient } from '../../database/interventions-db';

// Parse medical history to extract observations and notes
function parseMedicalHistory(medicalHistory: string | undefined): {
  observations: string[];
  notes: string;
} {
  if (!medicalHistory) return { observations: [], notes: '' };
  
  const obsMatch = medicalHistory.match(/Initial Observations: (.+?)(?:\n\nNotes:|$)/s);
  const notesMatch = medicalHistory.match(/Notes: (.+)$/s);
  
  const observations = obsMatch ? obsMatch[1].split(', ').filter(Boolean) : [];
  const notes = notesMatch ? notesMatch[1].trim() : '';
  
  return { observations, notes };
}

function calculateAge(dob: string | undefined): string {
  if (!dob) return '?';
  const birth = new Date(dob);
  const now = new Date();
  const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return age > 0 ? `${age}` : '?';
}

function getTriageColor(triage: string): string {
  const colors: Record<string, string> = {
    red: '#dc2626',
    yellow: '#f59e0b',
    green: '#16a34a',
    black: '#6b7280',
  };
  return colors[triage] || '#6b7280';
}

function getTriageLabel(triage: string): string {
  const labels: Record<string, string> = {
    red: 'CRITICAL',
    yellow: 'URGENT',
    green: 'MINOR',
    black: 'DECEASED',
  };
  return labels[triage] || triage.toUpperCase();
}

export function PatientDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { patientId, incidentId } = route.params as { patientId: string; incidentId: string };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  const loadData = useCallback(async () => {
    const [p, v, i] = await Promise.all([
      getPatientById(patientId),
      getVitalsByPatient(patientId),
      getInterventionsByPatient(patientId),
    ]);
    setPatient(p);
    setVitals(v);
    setInterventions(i);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const triageColor = getTriageColor(patient.triage_priority);
  const { observations, notes } = parseMedicalHistory(patient.medical_history);
  const age = calculateAge(patient.date_of_birth);
  const hasVitals = vitals.length > 0;
  const latestVital = hasVitals ? vitals[0] : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Patient Record</Text>
          <Text style={[styles.headerId, { color: triageColor }]}>
            #{patientId.slice(-6).toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { /* Edit patient */ }}>
          <MaterialIcons name="edit" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* TRIAGE BANNER - Most important for EMS */}
        <View style={[styles.triageBanner, { backgroundColor: `${triageColor}20` }, { borderColor: triageColor }]}>
          <View style={[styles.triageIndicator, { backgroundColor: triageColor }]}>
            <Text style={styles.triageIndicatorText}>
              {patient.triage_priority.toUpperCase()}
            </Text>
          </View>
          <View style={styles.triageInfo}>
            <Text style={[styles.triageLabel, { color: triageColor }]}>
              {getTriageLabel(patient.triage_priority)}
            </Text>
            <Text style={styles.triageTime}>
              Triaged at {new Date(patient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* PRIMARY CONDITION - Large and prominent */}
        <View style={styles.conditionCard}>
          <Text style={styles.conditionLabel}>PRIMARY CONDITION</Text>
          <Text style={styles.conditionText}>
            {patient.chief_complaint || 'No condition recorded'}
          </Text>
        </View>

        {/* PATIENT IDENTITY - Compact row */}
        <View style={styles.identityCard}>
          <View style={styles.identityItem}>
            <MaterialIcons name="person" size={20} color="#9ca3af" />
            <View>
              <Text style={styles.identityLabel}>NAME</Text>
              <Text style={styles.identityValue}>
                {patient.first_name && patient.last_name 
                  ? `${patient.first_name} ${patient.last_name}`
                  : patient.first_name || 'Unknown'}
              </Text>
            </View>
          </View>
          
          <View style={styles.identityDivider} />
          
          <View style={styles.identityItem}>
            <MaterialIcons name="wc" size={20} color="#9ca3af" />
            <View>
              <Text style={styles.identityLabel}>SEX / AGE</Text>
              <Text style={styles.identityValue}>
                {(patient.gender || '?').toUpperCase()} / {age}y
              </Text>
            </View>
          </View>
        </View>

        {/* FIELD OBSERVATIONS */}
        {(observations.length > 0 || notes) && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="visibility" size={20} color="#dc2626" />
              <Text style={styles.sectionTitle}>Field Observations</Text>
            </View>
            
            {observations.length > 0 && (
              <View style={styles.observationsGrid}>
                {observations.map((obs, index) => (
                  <View key={index} style={styles.observationBadge}>
                    <MaterialIcons name="check-circle" size={14} color="#22c55e" />
                    <Text style={styles.observationText}>{obs}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Additional Notes:</Text>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* LATEST VITALS - If available */}
        {latestVital && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="favorite" size={20} color="#dc2626" />
              <Text style={styles.sectionTitle}>Latest Vitals</Text>
              <Text style={styles.vitalsTime}>
                {new Date(latestVital.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            
            <View style={styles.vitalsGrid}>
              {latestVital.heart_rate && (
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalValue}>{latestVital.heart_rate}</Text>
                  <Text style={styles.vitalUnit}>BPM</Text>
                  <Text style={styles.vitalLabel}>Heart Rate</Text>
                </View>
              )}
              {latestVital.blood_pressure_systolic && (
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalValue}>
                    {latestVital.blood_pressure_systolic}/{latestVital.blood_pressure_diastolic || '-'}
                  </Text>
                  <Text style={styles.vitalUnit}>mmHg</Text>
                  <Text style={styles.vitalLabel}>Blood Pressure</Text>
                </View>
              )}
              {latestVital.oxygen_saturation && (
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalValue}>{latestVital.oxygen_saturation}%</Text>
                  <Text style={styles.vitalUnit}>SpO2</Text>
                  <Text style={styles.vitalLabel}>Oxygen Sat</Text>
                </View>
              )}
              {latestVital.respiratory_rate && (
                <View style={styles.vitalItem}>
                  <Text style={styles.vitalValue}>{latestVital.respiratory_rate}</Text>
                  <Text style={styles.vitalUnit}>rpm</Text>
                  <Text style={styles.vitalLabel}>Respiratory</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.viewAllVitalsBtn}
              onPress={() => navigation.navigate('VitalsHistory', { patientId } as never)}
            >
              <Text style={styles.viewAllVitalsText}>View All Vitals ({vitals.length})</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}

        {/* INTERVENTIONS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="medical-services" size={20} color="#dc2626" />
            <Text style={styles.sectionTitle}>Interventions</Text>
            <Text style={styles.interventionCount}>{interventions.length}</Text>
          </View>
          
          {interventions.length === 0 ? (
            <Text style={styles.emptyText}>No interventions recorded</Text>
          ) : (
            <View style={styles.interventionsList}>
              {interventions.slice(0, 3).map((intervention) => (
                <View key={intervention.id} style={styles.interventionItem}>
                  <View style={styles.interventionTime}>
                    <Text style={styles.interventionTimeText}>
                      {new Date(intervention.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.interventionContent}>
                    <Text style={styles.interventionName}>{intervention.name}</Text>
                    {intervention.dosage && (
                      <Text style={styles.interventionDetails}>
                        {intervention.dosage} {intervention.route && `• ${intervention.route}`}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              {interventions.length > 3 && (
                <TouchableOpacity 
                  style={styles.viewMoreBtn}
                  onPress={() => navigation.navigate('InterventionsHistory', { patientId } as never)}
                >
                  <Text style={styles.viewMoreText}>
                    +{interventions.length - 3} more interventions
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.vitalBtn]}
            onPress={() => navigation.navigate('AddVital', { patientId, incidentId } as never)}
          >
            <MaterialIcons name="favorite" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>Add Vitals</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.interventionBtn]}
            onPress={() => {
              console.log('Navigating to AddIntervention with:', { patientId, incidentId });
              navigation.navigate('AddIntervention', { patientId, incidentId } as never);
            }}
          >
            <MaterialIcons name="medication" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>Add Treatment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerId: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // TRIAGE BANNER
  triageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  triageIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  triageIndicatorText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  triageInfo: {
    flex: 1,
  },
  triageLabel: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  triageTime: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  // CONDITION CARD
  conditionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  conditionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 8,
    letterSpacing: 1,
  },
  conditionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 32,
  },
  // IDENTITY CARD
  identityCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  identityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 2,
  },
  identityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // SECTION CARDS
  sectionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  // OBSERVATIONS
  observationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  observationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  observationText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  notesBox: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  notesText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  // VITALS
  vitalsTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  vitalItem: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  vitalUnit: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  vitalLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  viewAllVitalsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  viewAllVitalsText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  // INTERVENTIONS
  interventionCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  interventionsList: {
    gap: 12,
  },
  interventionItem: {
    flexDirection: 'row',
    gap: 12,
  },
  interventionTime: {
    width: 50,
    alignItems: 'flex-start',
  },
  interventionTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  interventionContent: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 12,
  },
  interventionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  interventionDetails: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  viewMoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  vitalBtn: {
    backgroundColor: '#dc2626',
  },
  interventionBtn: {
    backgroundColor: '#374151',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
