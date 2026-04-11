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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Incident } from '../../types/database';
import { getActiveIncidents, getAllIncidents } from '../../database/incidents-db';
import { useSyncStore } from '../../stores/sync.store';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { runDiagnostics, getConnectionHelp } from '../../utils/diagnostics';

export function HomeScreen() {
  const navigation = useNavigation();
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
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
          <View style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <View>
                <View style={styles.statusRow}>
                  <Text style={styles.activeLabel}>ACTIVE CASE</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{activeIncident.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.caseTitle}>{activeIncident.chief_complaint || 'Incident'}</Text>
                <Text style={styles.caseLocation}>{activeIncident.address}</Text>
                <Text style={styles.caseTime}>Updated {new Date(activeIncident.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.caseId}>#{activeIncident.incident_number.slice(-3)}</Text>
            </View>

            <View style={styles.caseActions}>
              <TouchableOpacity
                style={styles.viewCaseButton}
                onPress={() => navigation.navigate('IncidentDetail', { incidentId: activeIncident.id } as never)}
              >
                <Text style={styles.viewCaseText}>VIEW CASE</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.closeCaseButton}>
                <MaterialIcons name="check-circle" size={16} color="#9ca3af" />
                <Text style={styles.closeCaseText}>CLOSE CASE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noActiveCard}>
            <MaterialIcons name="medical-services" size={48} color="#374151" />
            <Text style={styles.noActiveText}>No active case</Text>
            <Text style={styles.noActiveSubtext}>Log a new incident to begin</Text>
          </View>
        )}

        {/* Recent Cases */}
        <Text style={styles.sectionTitle}>Today ({recentIncidents.length})</Text>
        
        {recentIncidents.map((incident) => (
          <TouchableOpacity
            key={incident.id}
            style={styles.recentItem}
            onPress={() => navigation.navigate('IncidentDetail', { incidentId: incident.id } as never)}
          >
            <View>
              <Text style={styles.recentTitle}>{incident.chief_complaint || 'Incident'}</Text>
              <Text style={styles.recentLocation}>{incident.address}</Text>
            </View>
            <Text style={styles.recentTime}>
              {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        ))}
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
    padding: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 16,
  },
  newIncidentText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  activeCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  caseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  caseLocation: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  caseTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  caseId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  caseActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  viewCaseButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewCaseText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeCaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeCaseText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  noActiveCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  recentItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    opacity: 0.8,
  },
  recentTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  recentLocation: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  recentTime: {
    color: '#6b7280',
    fontSize: 12,
  },
});
