import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { Patient, Intervention, Vital } from '../../types/database';
import { getPatientById } from '../../database/patients-db';
import { getVitalsByPatient } from '../../database/vitals-db';
import { getInterventionsByPatient } from '../../database/interventions-db';
import { realtimeEvents } from '../../services/realtime.service';

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

// Vital sign alert styling
function getVitalAlertStyle(type: string, value: number): object {
  switch (type) {
    case 'hr':
      if (value < 50 || value > 120) return { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', borderWidth: 1 };
      if (value < 60 || value > 100) return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 };
      return {};
    case 'bp':
      if (value > 160 || value < 90) return { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', borderWidth: 1 };
      if (value > 140 || value < 100) return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 };
      return {};
    case 'spo2':
      if (value < 90) return { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', borderWidth: 1 };
      if (value < 95) return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 };
      return {};
    case 'rr':
      if (value < 8 || value > 30) return { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', borderWidth: 1 };
      if (value < 12 || value > 20) return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 };
      return {};
    case 'gcs':
      if (value < 9) return { backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', borderWidth: 1 };
      if (value < 13) return { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', borderWidth: 1 };
      return {};
    default:
      return {};
  }
}

// Intervention type colors and icons
function getInterventionColor(type: string): string {
  const colors: Record<string, string> = {
    medication: '#3b82f6',
    procedure: '#8b5cf6',
    airway: '#dc2626',
    iv_access: '#06b6d4',
    monitoring: '#10b981',
    other: '#6b7280',
  };
  return colors[type] || '#6b7280';
}

function getInterventionIcon(type: string): string {
  const icons: Record<string, string> = {
    medication: 'medication',
    procedure: 'medical-services',
    airway: 'airline-seat-flat',
    iv_access: 'opacity',
    monitoring: 'monitor',
    other: 'more-horiz',
  };
  return icons[type] || 'help';
}

// Patient response colors and icons
function getResponseColor(response: string): string {
  const colors: Record<string, string> = {
    'Improved': '#16a34a',
    'No Change': '#6b7280',
    'Deteriorated': '#dc2626',
    'Resolved': '#3b82f6',
    'Adverse Reaction': '#f59e0b',
  };
  return colors[response] || '#6b7280';
}

function getResponseIcon(response: string): string {
  const icons: Record<string, string> = {
    'Improved': 'trending-up',
    'No Change': 'remove',
    'Deteriorated': 'trending-down',
    'Resolved': 'check-circle',
    'Adverse Reaction': 'warning',
  };
  return icons[response] || 'help';
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

  // Listen for realtime updates
  useEffect(() => {
    const eventName = `incident:${incidentId}:changed`;
    const handleDataChanged = () => {
      console.log('PatientDetailScreen: Realtime update received, reloading...');
      loadData();
    };

    realtimeEvents.on(eventName, handleDataChanged);
    realtimeEvents.on('incidents:changed', handleDataChanged);
    
    return () => {
      realtimeEvents.off(eventName, handleDataChanged);
      realtimeEvents.off('incidents:changed', handleDataChanged);
    };
  }, [incidentId, loadData]);

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

        {/* ALL VITALS */}
        {vitals.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="favorite" size={20} color="#dc2626" />
              <Text style={styles.sectionTitle}>Vitals History</Text>
              <Text style={styles.vitalsTime}>{vitals.length} recordings</Text>
            </View>
            
            {vitals.map((vital, index) => (
              <TouchableOpacity 
                key={vital.id} 
                style={styles.vitalRecord}
                onPress={() => (navigation as any).navigate('AddVital', { 
                  patientId, 
                  incidentId, 
                  vitalId: vital.id,
                  isEdit: true 
                })}>
                <View style={styles.vitalRecordHeader}>
                  <Text style={styles.vitalRecordTime}>
                    {new Date(vital.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {index === 0 && (
                      <View style={styles.latestBadge}>
                        <Text style={styles.latestBadgeText}>LATEST</Text>
                      </View>
                    )}
                    <MaterialIcons name="edit" size={16} color="#6b7280" />
                  </View>
                </View>
                
                <View style={styles.vitalsGrid}>
                  {vital.heart_rate && (
                    <View style={[styles.vitalItem, getVitalAlertStyle('hr', vital.heart_rate)]}>
                      <Text style={styles.vitalValue}>{vital.heart_rate}</Text>
                      <Text style={styles.vitalUnit}>BPM</Text>
                      <Text style={styles.vitalLabel}>Heart Rate</Text>
                    </View>
                  )}
                  {vital.blood_pressure_systolic && (
                    <View style={[styles.vitalItem, getVitalAlertStyle('bp', vital.blood_pressure_systolic)]}>
                      <Text style={styles.vitalValue}>
                        {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic || '-'}
                      </Text>
                      <Text style={styles.vitalUnit}>mmHg</Text>
                      <Text style={styles.vitalLabel}>BP</Text>
                    </View>
                  )}
                  {vital.oxygen_saturation && (
                    <View style={[styles.vitalItem, getVitalAlertStyle('spo2', vital.oxygen_saturation)]}>
                      <Text style={styles.vitalValue}>{vital.oxygen_saturation}%</Text>
                      <Text style={styles.vitalUnit}>SpO2</Text>
                      <Text style={styles.vitalLabel}>Oxygen</Text>
                    </View>
                  )}
                  {vital.respiratory_rate && (
                    <View style={[styles.vitalItem, getVitalAlertStyle('rr', vital.respiratory_rate)]}>
                      <Text style={styles.vitalValue}>{vital.respiratory_rate}</Text>
                      <Text style={styles.vitalUnit}>rpm</Text>
                      <Text style={styles.vitalLabel}>Resp</Text>
                    </View>
                  )}
                  {vital.temperature && (
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalValue}>{vital.temperature}°</Text>
                      <Text style={styles.vitalUnit}>°C</Text>
                      <Text style={styles.vitalLabel}>Temp</Text>
                    </View>
                  )}
                  {vital.blood_glucose && (
                    <View style={styles.vitalItem}>
                      <Text style={styles.vitalValue}>{vital.blood_glucose}</Text>
                      <Text style={styles.vitalUnit}>mg/dL</Text>
                      <Text style={styles.vitalLabel}>Glucose</Text>
                    </View>
                  )}
                </View>
                
                {vital.notes && (
                  <Text style={styles.vitalNotes}>{vital.notes}</Text>
                )}
                
                {index < vitals.length - 1 && <View style={styles.vitalDivider} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* INTERVENTIONS - Complete Timeline */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="medical-services" size={20} color="#dc2626" />
            <Text style={styles.sectionTitle}>Treatment Timeline</Text>
            <Text style={styles.interventionCount}>{interventions.length}</Text>
          </View>
          
          {interventions.length === 0 ? (
            <Text style={styles.emptyText}>No interventions recorded</Text>
          ) : (
            <View style={styles.timelineContainer}>
              {interventions.map((intervention, index) => (
                <View key={intervention.id} style={styles.timelineItem}>
                  {/* Timeline line */}
                  {index < interventions.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                  
                  {/* Timeline dot */}
                  <View style={[styles.timelineDot, { backgroundColor: getInterventionColor(intervention.type) }]}>
                    <MaterialIcons 
                      name={getInterventionIcon(intervention.type) as any} 
                      size={14} 
                      color="#fff" 
                    />
                  </View>
                  
                  {/* Content */}
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineTime}>
                        {new Date(intervention.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <View style={[styles.typeBadge, { backgroundColor: `${getInterventionColor(intervention.type)}30` }]}>
                        <Text style={[styles.typeBadgeText, { color: getInterventionColor(intervention.type) }]}>
                          {intervention.type}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.interventionName}>{intervention.name}</Text>
                    
                    {(intervention.dosage || intervention.route) && (
                      <View style={styles.interventionMeta}>
                        {intervention.dosage && (
                          <View style={styles.metaBadge}>
                            <MaterialIcons name="medication" size={12} color="#9ca3af" />
                            <Text style={styles.metaText}>{intervention.dosage}</Text>
                          </View>
                        )}
                        {intervention.route && (
                          <View style={styles.metaBadge}>
                            <MaterialIcons name="route" size={12} color="#9ca3af" />
                            <Text style={styles.metaText}>{intervention.route}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    {intervention.response && (
                      <View style={[styles.responseBadge, { backgroundColor: getResponseColor(intervention.response) }]}>
                        <MaterialIcons 
                          name={getResponseIcon(intervention.response) as any} 
                          size={14} 
                          color="#fff" 
                        />
                        <Text style={styles.responseBadgeText}>{intervention.response}</Text>
                      </View>
                    )}
                    
                    {intervention.notes && (
                      <Text style={styles.interventionNotes}>{intervention.notes}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding for scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FIXED ACTION BUTTONS - Always visible at bottom */}
      <View style={styles.actionButtonsFixed}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.vitalBtn]}
          onPress={() => {
            console.log('Navigating to AddVital with:', { patientId, incidentId });
            (navigation as any).navigate('AddVital', { patientId, incidentId });
          }}
        >
          <MaterialIcons name="favorite" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Add Vitals</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, styles.interventionBtn]}
          onPress={() => {
            console.log('Navigating to AddIntervention with:', { patientId, incidentId });
            (navigation as any).navigate('AddIntervention', { patientId, incidentId });
          }}
        >
          <MaterialIcons name="medication" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Add Treatment</Text>
        </TouchableOpacity>
      </View>
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
  interventionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  interventionNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 18,
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
  // TIMELINE STYLES
  timelineContainer: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 30,
    width: 2,
    height: '100%',
    backgroundColor: '#374151',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  interventionMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  responseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    marginTop: 8,
  },
  responseBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // VITALS HISTORY STYLES
  vitalRecord: {
    marginBottom: 16,
  },
  vitalRecordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vitalRecordTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  latestBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  latestBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  vitalDivider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginTop: 16,
  },
  vitalNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // ACTION BUTTONS
  actionButtonsFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#0f0f0f',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
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
