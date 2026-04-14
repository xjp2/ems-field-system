import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';

import { Incident, Patient, IncidentStatus, Photo } from '../../types/database';
import { getIncidentById, updateIncident, getIncidentServerId } from '../../database/incidents-db';
import { getPatientsByIncident, getTriageCounts } from '../../database/patients-db';
import { getPhotosByIncident, createPhoto } from '../../database/photos-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';

import type { MaterialIcons as MaterialIconsType } from '@expo/vector-icons';
const STATUS_FLOW: { key: IncidentStatus; label: string; icon: React.ComponentProps<typeof MaterialIconsType>['name']; timeField: keyof Incident }[] = [
  { key: 'on_scene', label: 'On Scene', icon: 'location-on', timeField: 'on_scene_at' },
  { key: 'transporting', label: 'Transport', icon: 'local-shipping', timeField: 'transporting_at' },
  { key: 'arrived', label: 'Arrived', icon: 'local-hospital', timeField: 'arrived_at' },
  { key: 'closed', label: 'Closed', icon: 'check-circle', timeField: 'closed_at' },
];

// Get status timestamp from incident
// on_scene uses created_at as its time
function getStatusTime(incident: Incident, status: IncidentStatus): string | null {
  if (status === 'on_scene') {
    return incident.created_at;
  }
  const field = STATUS_FLOW.find(s => s.key === status)?.timeField;
  if (!field) return null;
  const time = incident[field] as string | undefined;
  return time || null;
}

// Format time difference between two timestamps
function formatTimeDiff(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  
  if (diffHours > 0) {
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

export function IncidentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { incidentId } = route.params as { incidentId: string };
  const { sync } = useSyncStore();
  
  const [incident, setIncident] = useState<Incident | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [triageCounts, setTriageCounts] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showSituationModal, setShowSituationModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingSituation, setEditingSituation] = useState('');

  const loadData = useCallback(async () => {
    const [inc, pts, counts, pics] = await Promise.all([
      getIncidentById(incidentId),
      getPatientsByIncident(incidentId),
      getTriageCounts(incidentId),
      getPhotosByIncident(incidentId),
    ]);
    setIncident(inc);
    setPatients(pts);
    setTriageCounts(counts);
    setPhotos(pics);
  }, [incidentId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleStatusUpdate = async (newStatus: IncidentStatus) => {
    if (!incident) return;
    
    try {
      const updateData: any = { status: newStatus };
      const timeField = STATUS_FLOW.find(s => s.key === newStatus)?.timeField;
      if (timeField) {
        updateData[timeField] = new Date().toISOString();
      }
      
      await updateIncident(incident.id, updateData);
      const serverId = await getIncidentServerId(incident.id);
      await addToSyncQueue('incidents', incident.id, 'UPDATE', updateData, serverId ? { serverId } : undefined);
      
      sync().catch(err => console.log('Sync failed:', err.message));
      setShowStatusModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  const handleNotesUpdate = async () => {
    if (!incident) return;
    
    try {
      const { estimate } = incident.scene_description 
        ? parseCasualtyEstimate(incident.scene_description)
        : { estimate: null };
      
      let newSceneDescription = '';
      if (estimate) {
        newSceneDescription = `Initial Casualty Estimate: RED: ${estimate.red}, YELLOW: ${estimate.yellow}, GREEN: ${estimate.green}, BLACK: ${estimate.black}\n\n`;
      }
      newSceneDescription += editingNotes.trim();
      
      await updateIncident(incident.id, { scene_description: newSceneDescription });
      const serverId = await getIncidentServerId(incident.id);
      await addToSyncQueue('incidents', incident.id, 'UPDATE', { 
        scene_description: newSceneDescription 
      }, serverId ? { serverId } : undefined);
      
      sync().catch(err => console.log('Sync failed:', err.message));
      setShowNotesModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update notes');
    }
  };

  const handleSituationUpdate = async () => {
    if (!incident) return;
    
    try {
      await updateIncident(incident.id, { chief_complaint: editingSituation.trim() });
      const serverId = await getIncidentServerId(incident.id);
      await addToSyncQueue('incidents', incident.id, 'UPDATE', { 
        chief_complaint: editingSituation.trim() 
      }, serverId ? { serverId } : undefined);
      
      sync().catch(err => console.log('Sync failed:', err.message));
      setShowSituationModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update situation');
    }
  };

  const openNotesEditor = () => {
    if (!incident) return;
    const { notes } = incident.scene_description 
      ? parseCasualtyEstimate(incident.scene_description)
      : { notes: '' };
    setEditingNotes(notes);
    setShowNotesModal(true);
  };

  const openSituationEditor = () => {
    if (!incident) return;
    setEditingSituation(incident.chief_complaint || '');
    setShowSituationModal(true);
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose a method',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickPhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library permission is needed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const savePhoto = async (uri: string) => {
    if (!incident) return;
    
    try {
      const photo = await createPhoto({
        incident_id: incidentId,
        uri,
        taken_at: new Date().toISOString(),
      });

      // Add to sync queue
      await addToSyncQueue('photos', photo.id, 'CREATE', {
        incident_id: incidentId,
        uri: photo.uri,
        taken_at: photo.taken_at,
      });

      // Trigger sync
      sync().catch(err => console.log('Photo sync failed:', err.message));
      
      // Refresh photos
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save photo');
    }
  };

  if (!incident) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === incident.status);
  
  const { estimate: casualtyEstimate, notes: sceneNotes } = incident.scene_description 
    ? parseCasualtyEstimate(incident.scene_description)
    : { estimate: null, notes: '' };

  // Build timeline data with times and diffs
  const timelineData = STATUS_FLOW.map((status, index) => {
    const time = getStatusTime(incident, status.key);
    let timeDiff: string | null = null;
    
    if (time && index > 0) {
      for (let i = index - 1; i >= 0; i--) {
        const prevTime = getStatusTime(incident, STATUS_FLOW[i].key);
        if (prevTime) {
          timeDiff = formatTimeDiff(prevTime, time);
          break;
        }
      }
    }
    
    return { ...status, time, timeDiff };
  });

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
        {/* Horizontal Status Timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeaderRow}>
            <Text style={styles.timelineTitle}>Status Timeline</Text>
            <TouchableOpacity 
              style={styles.updateButton}
              onPress={() => setShowStatusModal(true)}
            >
              <Text style={styles.updateText}>UPDATE</Text>
              <MaterialIcons name="arrow-forward" size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
          
          {/* Timeline - Time on dot, Time diff on line */}
          <View style={styles.horizontalTimeline}>
            {timelineData.map((status, index) => {
              const isActive = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const hasTime = status.time !== null;
              
              return (
                <View key={status.key} style={styles.timelineStep}>
                  {/* Connector line with time diff */}
                  {index > 0 && (
                    <View style={styles.timelineConnectorContainer}>
                      <View style={[
                        styles.timelineConnector,
                        isActive && styles.timelineConnectorActive
                      ]} />
                      {/* Time difference on the line */}
                      {status.timeDiff && (
                        <View style={styles.timelineDiffBadge}>
                          <Text style={styles.timelineDiffBadgeText}>+{status.timeDiff}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Step dot with time above */}
                  <View style={styles.timelineDotWrapper}>
                    {status.time && (
                      <Text style={styles.timelineDotTime}>
                        {new Date(status.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                    <View style={[
                      styles.timelineStepDot,
                      hasTime && styles.timelineStepDotActive,
                      isCurrent && styles.timelineStepDotCurrent
                    ]}>
                      <MaterialIcons
                        name={status.icon}
                        size={14}
                        color={hasTime ? '#fff' : '#6b7280'}
                      />
                    </View>
                  </View>
                  
                  {/* Label below dot */}
                  <Text style={[
                    styles.timelineStepLabel,
                    hasTime && styles.timelineStepLabelActive,
                    isCurrent && styles.timelineStepLabelCurrent
                  ]}>
                    {status.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Situation Type - Editable */}
        <TouchableOpacity style={styles.compactCard} onPress={openSituationEditor} activeOpacity={0.7}>
          <MaterialIcons name="emergency" size={18} color="#dc2626" />
          <Text style={styles.compactCardText}>{incident.chief_complaint || 'Tap to set situation type'}</Text>
          <MaterialIcons name="edit" size={16} color="#6b7280" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <MaterialIcons name="location-on" size={18} color="#dc2626" />
            <Text style={styles.cardTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>{incident.address}</Text>
          {incident.latitude && incident.longitude && (
            <TouchableOpacity 
              style={styles.mapPreviewContainer}
              onPress={() => openMap(incident.latitude!, incident.longitude!)}
            >
              <MapView
                style={styles.mapPreview}
                region={{
                  latitude: incident.latitude,
                  longitude: incident.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                  pinColor="#dc2626"
                />
              </MapView>
              <View style={styles.mapOverlay}>
                <MaterialIcons name="open-in-new" size={16} color="#fff" />
                <Text style={styles.mapOverlayText}>Open Maps</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Casualty Summary */}
        <View style={styles.casualtyCard}>
          <View style={styles.casualtyHeader}>
            <MaterialIcons name="groups" size={18} color="#dc2626" />
            <Text style={styles.casualtyTitle}>Casualty Summary</Text>
          </View>
          
          {casualtyEstimate && (
            <View style={styles.casualtyRow}>
              <Text style={styles.casualtyRowLabel}>Initial Estimate</Text>
              <View style={styles.casualtyCounts}>
                <View style={styles.countItem}>
                  <Text style={[styles.countValue, { color: '#dc2626' }]}>{casualtyEstimate.red}</Text>
                  <Text style={styles.countLabel}>RED</Text>
                </View>
                <View style={styles.countItem}>
                  <Text style={[styles.countValue, { color: '#f59e0b' }]}>{casualtyEstimate.yellow}</Text>
                  <Text style={styles.countLabel}>YEL</Text>
                </View>
                <View style={styles.countItem}>
                  <Text style={[styles.countValue, { color: '#16a34a' }]}>{casualtyEstimate.green}</Text>
                  <Text style={styles.countLabel}>GRN</Text>
                </View>
                <View style={styles.countItem}>
                  <Text style={[styles.countValue, { color: '#6b7280' }]}>{casualtyEstimate.black}</Text>
                  <Text style={styles.countLabel}>BLK</Text>
                </View>
              </View>
            </View>
          )}
          
          <View style={styles.casualtyRow}>
            <Text style={styles.casualtyRowLabel}>Actual Patients</Text>
            <View style={styles.casualtyCounts}>
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: '#dc2626' }]}>{triageCounts.red}</Text>
                <Text style={styles.countLabel}>RED</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: '#f59e0b' }]}>{triageCounts.yellow}</Text>
                <Text style={styles.countLabel}>YEL</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: '#16a34a' }]}>{triageCounts.green}</Text>
                <Text style={styles.countLabel}>GRN</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: '#6b7280' }]}>{triageCounts.black}</Text>
                <Text style={styles.countLabel}>BLK</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Scene Notes - Editable */}
        <TouchableOpacity style={styles.card} onPress={openNotesEditor} activeOpacity={0.7}>
          <View style={styles.cardIconRow}>
            <MaterialIcons name="description" size={18} color="#dc2626" />
            <Text style={styles.cardTitle}>Scene Notes</Text>
            <MaterialIcons name="edit" size={16} color="#6b7280" style={{ marginLeft: 'auto' }} />
          </View>
          {sceneNotes ? (
            <Text style={styles.notesText}>{sceneNotes}</Text>
          ) : (
            <Text style={styles.notesPlaceholder}>Tap to add scene notes...</Text>
          )}
        </TouchableOpacity>

        {/* Photos Section */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <MaterialIcons name="photo-camera" size={18} color="#dc2626" />
            <Text style={styles.cardTitle}>Scene Photos ({photos.length})</Text>
            <TouchableOpacity 
              style={styles.addPhotoBtn}
              onPress={showPhotoOptions}
            >
              <MaterialIcons name="add-a-photo" size={16} color="#fff" />
              <Text style={styles.addPhotoBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {photos.length === 0 ? (
            <View style={styles.emptyPhotosContainer}>
              <MaterialIcons name="photo-library" size={40} color="#374151" />
              <Text style={styles.notesPlaceholder}>No photos added</Text>
              <TouchableOpacity style={styles.takePhotoBtn} onPress={showPhotoOptions}>
                <MaterialIcons name="camera-alt" size={20} color="#dc2626" />
                <Text style={styles.takePhotoBtnText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={photos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.photoThumbnail}
                  onPress={() => {
                    setSelectedPhoto(item);
                    setShowPhotoModal(true);
                  }}
                >
                  <Image source={{ uri: item.uri }} style={styles.photoThumbImage} />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.photoList}
            />
          )}
        </View>

        {/* Patient List Header */}
        <View style={styles.patientListHeader}>
          <Text style={styles.sectionTitle}>Patients ({patients.length})</Text>
          <TouchableOpacity
            style={styles.addPatientBtn}
            onPress={() => (navigation as any).navigate('NewPatient', { incidentId })}
          >
            <MaterialIcons name="person-add" size={16} color="#fff" />
            <Text style={styles.addPatientBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        
        {/* Patient List */}
        {patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="person-off" size={40} color="#374151" />
            <Text style={styles.emptyText}>No patients logged</Text>
          </View>
        ) : (
          <>
            {patients.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientItem}
                onPress={() => (navigation as any).navigate('PatientDetail', { 
                  patientId: patient.id, 
                  incidentId 
                })}
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
                    {(patient.gender || '?').toUpperCase()} • {calculateAge(patient.date_of_birth)} • {patient.chief_complaint || 'No condition'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </>
        )}
        
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Case Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {STATUS_FLOW.map((status, index) => {
              const isActive = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isPast = index < currentStatusIndex;
              const statusTime = getStatusTime(incident, status.key);
              
              return (
                <TouchableOpacity
                  key={status.key}
                  style={[
                    styles.statusOption,
                    isCurrent && styles.statusOptionCurrent,
                    isPast && styles.statusOptionPast
                  ]}
                  onPress={() => handleStatusUpdate(status.key)}
                  disabled={isCurrent || isPast}
                >
                  <View style={[
                    styles.statusOptionDot,
                    isActive && styles.statusOptionDotActive,
                    isCurrent && styles.statusOptionDotCurrent
                  ]}>
                    <MaterialIcons 
                      name={status.icon} 
                      size={16} 
                      color={isActive ? '#fff' : '#6b7280'} 
                    />
                  </View>
                  <View style={styles.statusOptionContent}>
                    <Text style={[
                      styles.statusOptionLabel,
                      isActive && styles.statusOptionLabelActive,
                      isCurrent && styles.statusOptionLabelCurrent
                    ]}>
                      {status.label}
                    </Text>
                    {statusTime && (
                      <Text style={styles.statusOptionTime}>
                        {new Date(statusTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                    {isCurrent && (
                      <Text style={styles.statusOptionSubtext}>Current Status</Text>
                    )}
                  </View>
                  {isActive && !isCurrent && (
                    <MaterialIcons name="check" size={20} color="#16a34a" />
                  )}
                  {isCurrent && (
                    <MaterialIcons name="radio-button-checked" size={20} color="#dc2626" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Scene Notes Edit Modal */}
      <Modal
        visible={showNotesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotesModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Scene Notes</Text>
                <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={6}
                  placeholder="Enter scene notes..."
                  placeholderTextColor="#6b7280"
                  value={editingNotes}
                  onChangeText={setEditingNotes}
                  textAlignVertical="top"
                />
              </ScrollView>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalBtnSecondary}
                  onPress={() => setShowNotesModal(false)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalBtnPrimary}
                  onPress={handleNotesUpdate}
                >
                  <Text style={styles.modalBtnPrimaryText}>Save Notes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Situation Type Edit Modal */}
      <Modal
        visible={showSituationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSituationModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Situation Type</Text>
                <TouchableOpacity onPress={() => setShowSituationModal(false)}>
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <TextInput
                  style={styles.situationInput}
                  placeholder="e.g., Multi-vehicle collision, Cardiac arrest..."
                  placeholderTextColor="#6b7280"
                  value={editingSituation}
                  onChangeText={setEditingSituation}
                />
              </ScrollView>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalBtnSecondary}
                  onPress={() => setShowSituationModal(false)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalBtnPrimary}
                  onPress={handleSituationUpdate}
                >
                  <Text style={styles.modalBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalHeader}>
            <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {selectedPhoto?.caption && (
              <Text style={styles.photoModalCaption}>{selectedPhoto.caption}</Text>
            )}
            <View style={{ width: 28 }} />
          </View>
          {selectedPhoto && (
            <Image source={{ uri: selectedPhoto.uri }} style={styles.photoFullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
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

function calculateAge(dob: string | undefined): string {
  if (!dob) return '?';
  const birth = new Date(dob);
  const now = new Date();
  const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return age > 0 ? `${age}y` : '?';
}

function parseCasualtyEstimate(sceneDescription: string): { 
  estimate: { red: number; yellow: number; green: number; black: number } | null;
  notes: string;
} {
  const match = sceneDescription.match(/Initial Casualty Estimate: RED: (\d+), YELLOW: (\d+), GREEN: (\d+), BLACK: (\d+)/);
  if (match) {
    const notes = sceneDescription.replace(/Initial Casualty Estimate:.*?\n?\n?/, '').trim();
    return {
      estimate: {
        red: parseInt(match[1]),
        yellow: parseInt(match[2]),
        green: parseInt(match[3]),
        black: parseInt(match[4]),
      },
      notes,
    };
  }
  return { estimate: null, notes: sceneDescription };
}

function openMap(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps:${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}`,
  });
  if (url) Linking.openURL(url);
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
    padding: 12,
  },
  
  // Timeline Card
  timelineCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  timelineTitle: {
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
  
  // Horizontal Timeline - Time on dot, Diff on line
  horizontalTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 8,
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  timelineConnectorContainer: {
    position: 'absolute',
    top: 14, // Center of dot (20 paddingTop + 14 = 34, half of 32px dot is 16, so 34-16=18, adjusted)
    left: '-50%',
    right: '50%',
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  timelineConnector: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#374151',
  },
  timelineConnectorActive: {
    backgroundColor: '#dc2626',
  },
  timelineDiffBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  timelineDiffBadgeText: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: '600',
  },
  timelineDotWrapper: {
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 1,
  },
  timelineDotTime: {
    position: 'absolute',
    top: -18,
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  timelineStepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineStepDotActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  timelineStepDotCurrent: {
    transform: [{ scale: 1.1 }],
    borderColor: '#fff',
  },
  timelineStepLabel: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  timelineStepLabelActive: {
    color: '#9ca3af',
  },
  timelineStepLabelCurrent: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Compact Cards
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  compactCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  
  // Regular Card
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mapPreviewContainer: {
    marginTop: 10,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPreview: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  notesPlaceholder: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  
  // Casualty Summary Card
  casualtyCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  casualtyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  casualtyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  casualtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  casualtyRowLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  casualtyCounts: {
    flexDirection: 'row',
    gap: 16,
  },
  countItem: {
    alignItems: 'center',
    minWidth: 32,
  },
  countValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  countLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  
  // Patient List
  patientListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addPatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPatientBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
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
  patientItem: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  patientAvatarText: {
    color: '#fff',
    fontSize: 18,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  triageBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  triageBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  patientDetails: {
    fontSize: 12,
    color: '#9ca3af',
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Status Modal
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    opacity: 1,
  },
  statusOptionCurrent: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  statusOptionPast: {
    opacity: 0.4,
  },
  statusOptionDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOptionDotActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  statusOptionDotCurrent: {
    backgroundColor: '#dc2626',
    borderColor: '#fff',
  },
  statusOptionContent: {
    flex: 1,
  },
  statusOptionLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  statusOptionLabelActive: {
    color: '#d1d5db',
  },
  statusOptionLabelCurrent: {
    color: '#fff',
    fontWeight: '600',
  },
  statusOptionTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusOptionSubtext: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  
  // Notes Modal
  notesInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  
  // Situation Modal
  situationInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnSecondary: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Photos
  photoList: {
    paddingVertical: 8,
    gap: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#0f0f0f',
    marginRight: 8,
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  photoModalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    zIndex: 10,
  },
  photoModalCaption: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  photoFullImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 100,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  addPhotoBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  takePhotoBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
});
