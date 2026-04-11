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

import { Patient, Intervention } from '../../types/database';
import { getPatientById } from '../../database/patients-db';

// Mock interventions for demo
const MOCK_INTERVENTIONS: Intervention[] = [
  {
    id: '1',
    patient_id: 'p1',
    type: 'airway',
    name: 'Airway Secured',
    performed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    is_synced: false,
  },
  {
    id: '2',
    patient_id: 'p1',
    type: 'medication',
    name: 'Oxygen Administered',
    dosage: '15L/min',
    route: 'nasal cannula',
    performed_at: new Date(Date.now() - 5 * 60000).toISOString(),
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    is_synced: false,
  },
];

export function PatientDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { patientId, incidentId } = route.params as { patientId: string; incidentId: string };

  const [patient, setPatient] = useState<Patient | null>(null);

  const loadPatient = useCallback(async () => {
    const p = await getPatientById(patientId);
    setPatient(p);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      loadPatient();
    }, [loadPatient])
  );

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const triageColor = getTriageColor(patient.triage_priority);
  const interventions = MOCK_INTERVENTIONS;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Patient #{patientId.slice(-4)}</Text>
          <Text style={[styles.headerSubtitle, { color: triageColor }]}>
            {patient.triage_priority.toUpperCase()}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Patient Header Card */}
        <View style={styles.card}>
          <View style={styles.patientHeader}>
            <View style={[styles.avatar, { backgroundColor: triageColor }]}>
              <MaterialIcons name="person" size={32} color="#fff" />
            </View>
            <View style={styles.patientInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.patientName}>
                  {patient.first_name || 'Unknown'}
                </Text>
                <View style={[styles.triageBadge, { backgroundColor: triageColor }]}>
                  <Text style={styles.triageBadgeText}>
                    {patient.triage_priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.patientDetails}>
                {patient.gender || '?'} • ~{patient.date_of_birth ? calculateAge(patient.date_of_birth) : '?'} years
              </Text>
              <Text style={[styles.condition, { color: triageColor }]}>
                {patient.chief_complaint}
              </Text>
            </View>
          </View>
        </View>

        {/* Field Observations */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="visibility" size={20} color="#dc2626" />
            <Text style={styles.cardTitle}>Field Observations</Text>
          </View>
          {patient.observations && patient.observations.length > 0 ? (
            <View style={styles.observationsList}>
              {patient.observations.map((obs, index) => (
                <View key={index} style={styles.observationItem}>
                  <MaterialIcons name="check-circle" size={16} color="#dc2626" />
                  <Text style={styles.observationText}>{obs}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No observations recorded</Text>
          )}
        </View>

        {/* Intervention Log */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="history" size={20} color="#dc2626" />
              <Text style={styles.cardTitle}>Intervention Log</Text>
            </View>
            <Text style={styles.entryCount}>{interventions.length + 1} entries</Text>
          </View>

          <View style={styles.timeline}>
            {/* First Contact */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <View style={[styles.timelineDotInner, { backgroundColor: '#dc2626' }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>
                  {new Date(patient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.timelineTitle}>First contact / Initial assessment</Text>
                <Text style={styles.timelineSubtitle}>Patient logged to case</Text>
              </View>
            </View>

            {/* Interventions */}
            {interventions.map((intervention, index) => (
              <View key={intervention.id} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                  <View style={styles.timelineDotInner} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTime}>
                    {new Date(intervention.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.timelineTitle}>{intervention.name}</Text>
                  {intervention.dosage && (
                    <Text style={styles.timelineSubtitle}>
                      {intervention.dosage} {intervention.route && `• ${intervention.route}`}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Add Log Entry Button */}
        <TouchableOpacity style={styles.addLogButton}>
          <MaterialIcons name="add" size={20} color="#000" />
          <Text style={styles.addLogText}>ADD LOG ENTRY</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
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

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
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
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  patientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  triageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  triageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  patientDetails: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  condition: {
    fontSize: 15,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  observationsList: {
    gap: 8,
  },
  observationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  observationText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 20,
    alignItems: 'center',
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#0f0f0f',
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  timelineSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addLogButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  addLogText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
