import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Incident } from '../../types/database';
import { getActiveIncidents, getAllIncidents } from '../../database/incidents-db';
import { getTriageCounts } from '../../database/patients-db';
import { useSyncStore } from '../../stores/sync.store';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { runDiagnostics, getConnectionHelp } from '../../utils/diagnostics';
import { realtimeEvents } from '../../services/realtime.service';

type TriageCounts = { red: number; yellow: number; green: number; black: number };

export function HomeScreen() {
  const navigation = useNavigation();
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [casualtyCounts, setCasualtyCounts] = useState<Record<string, TriageCounts>>({});
  const [refreshing, setRefreshing] = useState(false);
  
  const { sync, pendingCount, updateStatus } = useSyncStore();

  const loadData = useCallback(async () => {
    console.log('HomeScreen: Loading data...');
    const [active, all] = await Promise.all([
      getActiveIncidents(),
      getAllIncidents(),
    ]);
    console.log('HomeScreen: Loaded', active.length, 'active,', all.length, 'total incidents');
    setActiveIncidents(active);
    setRecentIncidents(all.slice(0, 5));
    
    // Load casualty counts for recent incidents
    const counts: Record<string, TriageCounts> = {};
    for (const incident of all.slice(0, 5)) {
      counts[incident.id] = await getTriageCounts(incident.id);
    }
    setCasualtyCounts(counts);
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen: Focused - reloading data');
      loadData();
      updateStatus(); // Also update sync status
    }, [loadData, updateStatus])
  );
  
  // Initial load
  useEffect(() => {
    loadData();
    updateStatus();
  }, []);

  // Listen for realtime data changes
  useEffect(() => {
    const handleDataChanged = () => {
      console.log('HomeScreen: Realtime data changed, reloading...');
      loadData();
    };

    realtimeEvents.on('incidents:changed', handleDataChanged);
    return () => {
      realtimeEvents.off('incidents:changed', handleDataChanged);
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Sync with 10 second timeout
      const syncPromise = sync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), 10000)
      );
      await Promise.race([syncPromise, timeoutPromise]).catch(err => {
        console.warn('Sync warning:', err.message);
      });
      
      // Always reload data even if sync had issues
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const showDiagnostics = async () => {
    const result = await runDiagnostics();
    const help = getConnectionHelp(result.steps);
    const stepDetails = result.steps.map(s => 
      `${s.status === 'pass' ? '✓' : '✗'} ${s.name}: ${s.message}`
    ).join('\n');
    
    Alert.alert(
      result.success ? 'All Systems Go' : 'Connection Issues',
      `${stepDetails}\n\n${help}`,
      [{ text: 'OK' }]
    );
  };

  const activeIncident = activeIncidents[0];
  const hasActiveCase = activeIncidents.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <MaterialIcons name="medical-services" size={24} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Field Response</Text>
            <Text style={styles.headerSubtitle}>Medical Team</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={showDiagnostics} style={styles.diagnosticButton}>
            <MaterialIcons name="network-check" size={20} color="#6b7280" />
          </TouchableOpacity>
          <ConnectionStatus />
          {pendingCount > 0 && (
            <View style={styles.syncBadge}>
              <MaterialIcons name="sync" size={16} color="#fff" />
              <Text style={styles.syncCount}>{pendingCount}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        {/* Log New Incident Button */}
        <TouchableOpacity
          style={styles.newIncidentButton}
          onPress={() => navigation.navigate('NewIncident' as never)}
        >
          <MaterialIcons name="add-circle" size={28} color="#fff" />
          <Text style={styles.newIncidentText}>LOG NEW INCIDENT</Text>
        </TouchableOpacity>

        {/* Active Case Card */}
        {hasActiveCase && activeIncident ? (
          <TouchableOpacity 
            style={styles.activeCard}
            onPress={() => navigation.navigate('IncidentDetail', { incidentId: activeIncident.id } as never)}
            activeOpacity={0.8}
          >
            {/* Card Header */}
            <View style={styles.activeCardHeader}>
              <View style={styles.statusRow}>
                <View style={styles.activeBadge}>
                  <MaterialIcons name="emergency" size={12} color="#dc2626" />
                  <Text style={styles.activeLabel}>ACTIVE</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{activeIncident.status.toUpperCase()}</Text>
                </View>
              </View>
              
              <Text style={styles.caseId}>#{activeIncident.incident_number.slice(-3)}</Text>
            </View>

            {/* Case Content */}
            <View style={styles.caseContent}>
              <Text style={styles.caseTitle} numberOfLines={1}>
                {activeIncident.chief_complaint || 'Incident'}
              </Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={14} color="#6b7280" />
                <Text style={styles.caseLocation} numberOfLines={1}>
                  {activeIncident.address}
                </Text>
              </View>
              <Text style={styles.caseTime}>
                Updated {new Date(activeIncident.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {/* Action Button */}
            <View style={styles.caseActionRow}>
              <View style={styles.viewCaseButton}>
                <Text style={styles.viewCaseText}>VIEW CASE</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.noActiveCard}>
            <MaterialIcons name="medical-services" size={48} color="#374151" />
            <Text style={styles.noActiveText}>No active case</Text>
            <Text style={styles.noActiveSubtext}>Log a new incident to begin</Text>
          </View>
        )}

        {/* Recent Cases */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Cases</Text>
          <Text style={styles.sectionCount}>{recentIncidents.length}</Text>
        </View>
        
        {recentIncidents.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={32} color="#374151" />
            <Text style={styles.emptyText}>No cases today</Text>
          </View>
        ) : (
          recentIncidents.map((incident) => {
            const counts = casualtyCounts[incident.id] || { red: 0, yellow: 0, green: 0, black: 0 };
            const totalPatients = counts.red + counts.yellow + counts.green + counts.black;
            
            return (
              <TouchableOpacity
                key={incident.id}
                style={styles.recentItem}
                onPress={() => navigation.navigate('IncidentDetail', { incidentId: incident.id } as never)}
              >
                {/* Left: Title & Location */}
                <View style={styles.recentLeft}>
                  <View style={styles.recentHeader}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {incident.chief_complaint || 'Incident'}
                    </Text>
                  </View>
                  <View style={styles.recentLocationRow}>
                    <MaterialIcons name="location-on" size={12} color="#6b7280" />
                    <Text style={styles.recentLocation} numberOfLines={1}>
                      {incident.address}
                    </Text>
                  </View>
                </View>
                
                {/* Right: Casualty Counts & Time */}
                <View style={styles.recentRight}>
                  {/* Casualty Counts */}
                  {totalPatients > 0 ? (
                    <View style={styles.casualtyCounts}>
                      {counts.red > 0 && (
                        <View style={[styles.casualtyBadge, { backgroundColor: '#dc2626' }]}>
                          <Text style={styles.casualtyText}>{counts.red}</Text>
                        </View>
                      )}
                      {counts.yellow > 0 && (
                        <View style={[styles.casualtyBadge, { backgroundColor: '#f59e0b' }]}>
                          <Text style={styles.casualtyText}>{counts.yellow}</Text>
                        </View>
                      )}
                      {counts.green > 0 && (
                        <View style={[styles.casualtyBadge, { backgroundColor: '#16a34a' }]}>
                          <Text style={styles.casualtyText}>{counts.green}</Text>
                        </View>
                      )}
                      {counts.black > 0 && (
                        <View style={[styles.casualtyBadge, { backgroundColor: '#6b7280' }]}>
                          <Text style={styles.casualtyText}>{counts.black}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noPatientsBadge}>
                      <Text style={styles.noPatientsText}>No patients</Text>
                    </View>
                  )}
                  
                  {/* Status, Case ID & Time */}
                  <View style={styles.recentMetaRow}>
                    <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(incident.status) + '30' }]}>
                      <Text style={[styles.statusTextSmall, { color: getStatusColor(incident.status) }]}>
                        {getShortStatusLabel(incident.status)}
                      </Text>
                    </View>
                    <Text style={styles.recentId}>#{incident.incident_number.slice(-3)}</Text>
                    <Text style={styles.recentTime}>
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Get color based on incident status
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    on_scene: '#dc2626',
    transporting: '#f59e0b',
    arrived: '#3b82f6',
    closed: '#16a34a',
    draft: '#6b7280',
    dispatched: '#dc2626',
    en_route: '#dc2626',
  };
  return colors[status] || '#6b7280';
}

// Get short status label
function getShortStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    on_scene: 'ON SCENE',
    transporting: 'TRANSPORT',
    arrived: 'ARRIVED',
    closed: 'CLOSED',
    draft: 'DRAFT',
    dispatched: 'DISPATCH',
    en_route: 'EN ROUTE',
  };
  return labels[status] || status.toUpperCase();
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  syncCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  newIncidentButton: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  newIncidentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Active Case Card
  activeCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  caseId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  caseContent: {
    marginBottom: 12,
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  caseLocation: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  caseTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  caseActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 12,
  },
  viewCaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  viewCaseText: {
    color: '#dc2626',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  // No Active State
  noActiveCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  noActiveText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  noActiveSubtext: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 14,
  },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  
  // Empty State
  emptyState: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 8,
    fontSize: 14,
  },
  
  // Recent Items - Improved Layout with Casualty Counts
  recentItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentLeft: {
    flex: 1,
    marginRight: 12,
    minWidth: 0, // Important for text truncation
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  recentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recentLocation: {
    color: '#6b7280',
    fontSize: 12,
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  casualtyCounts: {
    flexDirection: 'row',
    gap: 4,
  },
  casualtyBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  casualtyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  noPatientsBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noPatientsText: {
    color: '#9ca3af',
    fontSize: 10,
  },
  recentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentId: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  recentTime: {
    color: '#6b7280',
    fontSize: 11,
  },
});
