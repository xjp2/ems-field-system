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

import { Incident, Patient } from '../../types/database';
import { getIncidentById } from '../../database/incidents-db';
import { getPatientsByIncident, getTriageCounts } from '../../database/patients-db';

const STATUS_FLOW = [
  { key: 'on_scene', label: 'ON SCENE', icon: 'location-on' },
  { key: 'assessing', label: 'ASSESSING', icon: 'stethoscope' },
  { key: 'treating', label: 'TREATING', icon: 'medication' },
  { key: 'transporting', label: 'TRANSPORTING', icon: 'local-shipping' },
  { key: 'arrived', label: 'ARRIVED', icon: 'local-hospital' },
  { key: 'closed', label: 'CLOSED', icon: 'check-circle' },
];

export function IncidentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { incidentId } = route.params as { incidentId: string };
  
  const [incident, setIncident] = useState<Incident | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [triageCounts, setTriageCounts] = useState({ red: 0, yellow: 0, green: 0, black: 0 });

  const loadData = useCallback(async () => {
    const [inc, pts, counts] = await Promise.all([
      getIncidentById(incidentId),
      getPatientsByIncident(incidentId),
      getTriageCounts(incidentId),
    ]);
    setIncident(inc);
    setPatients(pts);
    setTriageCounts(counts);
  }, [incidentId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!incident) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === incident.status);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Case #{incident.incident_number.slice(-3)}</Text>
          <View style={styles.headerSubtitle}>
            <Text style={styles.statusText}>{incident.status.toUpperCase()}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.timeText}>
              {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Case Status Timeline</Text>
            <TouchableOpacity style={styles.updateButton}>
              <Text style={styles.updateText}>UPDATE</Text>
              <MaterialIcons name="arrow-forward" size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.timeline}>
            {STATUS_FLOW.slice(0, currentStatusIndex + 1).map((status, index) => (
              <View key={status.key} style={styles.timelineItem}>
                <View style={[
                  styles.timelineDot,
                  index === currentStatusIndex && styles.timelineDotActive,
                ]}>
                  <MaterialIcons
                    name={status.icon}
                    size={12}
                    color={index === currentStatusIndex ? '#fff' : '#9ca3af'}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={[
                      styles.timelineTime,
                      index === currentStatusIndex && styles.timelineTimeActive,
                    ]}>
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {index === currentStatusIndex && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentText}>CURRENT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.timelineLabel,
                    index === currentStatusIndex && styles.timelineLabelActive,
                  ]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <MaterialIcons name="location-on" size={20} color="#dc2626" />
            <Text style={styles.cardTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>{incident.address}</Text>
          {incident.latitude && (
            <Text style={styles.gpsText}>
              GPS: {incident.latitude.toFixed(4)}°, {incident.longitude?.toFixed(4)}°
            </Text>
          )}
        </View>

        {/* Scene Notes */}
        {incident.scene_description && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <MaterialIcons name="description" size={20} color="#dc2626" />
              <Text style={styles.cardTitle}>Scene Notes</Text>
            </View>
            <Text style={styles.notesText}>{incident.scene_description}</Text>
          </View>
        )}

        {/* Triage Summary */}
        <View style={styles.triageGrid}>
          <View style={styles.triageCard}>
            <Text style={[styles.triageCount, { color: '#dc2626' }]}>{triageCounts.red}</Text>
            <Text style={styles.triageLabel}>RED</Text>
          </View>
          <View style={styles.triageCard}>
            <Text style={[styles.triageCount, { color: '#f59e0b' }]}>{triageCounts.yellow}</Text>
            <Text style={styles.triageLabel}>YELLOW</Text>
          </View>
          <View style={styles.triageCard}>
            <Text style={[styles.triageCount, { color: '#16a34a' }]}>{triageCounts.green}</Text>
            <Text style={styles.triageLabel}>GREEN</Text>
          </View>
          <View style={styles.triageCard}>
            <Text style={[styles.triageCount, { color: '#6b7280' }]}>{triageCounts.black}</Text>
            <Text style={styles.triageLabel}>BLACK</Text>
          </View>
        </View>

        {/* Add Patient Button */}
        <TouchableOpacity
          style={styles.addPatientButton}
          onPress={() => navigation.navigate('NewPatient', { incidentId } as never)}
        >
          <MaterialIcons name="person-add" size={20} color="#000" />
          <Text style={styles.addPatientText}>ADD PATIENT</Text>
        </TouchableOpacity>

        {/* Patient List */}
        <Text style={styles.sectionTitle}>Patients ({patients.length})</Text>
        
        {patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="person-off" size={48} color="#374151" />
            <Text style={styles.emptyText}>No patients logged yet</Text>
            <Text style={styles.emptySubtext}>Add patients to the case</Text>
          </View>
        ) : (
          patients.map((patient) => (
            <TouchableOpacity
              key={patient.id}
              style={styles.patientItem}
              onPress={() => navigation.navigate('PatientDetail', { 
                patientId: patient.id, 
                incidentId 
              } as never)}
            >
              <View style={[
                styles.patientAvatar,
                { backgroundColor: getTriageColor(patient.triage_priority) },
              ]}>
                <Text style={styles.patientAvatarText}>
                  {patient.triage_priority.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.patientInfo}>
                <View style={styles.patientHeader}>
                  <Text style={styles.patientName}>{patient.first_name || 'Unknown'}</Text>
                  <View style={[
                    styles.triageBadge,
                    { backgroundColor: getTriageColor(patient.triage_priority) },
                  ]}>
                    <Text style={styles.triageBadgeText}>{patient.triage_priority.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.patientDetails}>
                  {patient.gender || '?'} • ~{patient.date_of_birth ? calculateAge(patient.date_of_birth) : '?'}y • {patient.chief_complaint || 'No condition'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#6b7280" />
            </TouchableOpacity>
          ))
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#dc2626',
  },
  dot: {
    color: '#6b7280',
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  updateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  timelineTimeActive: {
    color: '#dc2626',
  },
  currentBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  timelineLabelActive: {
    color: '#fff',
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  gpsText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  triageGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  triageCount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  triageLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  addPatientButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  addPatientText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 14,
  },
  patientItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  patientInfo: {
    flex: 1,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  triageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  triageBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  patientDetails: {
    fontSize: 13,
    color: '#9ca3af',
  },
});
