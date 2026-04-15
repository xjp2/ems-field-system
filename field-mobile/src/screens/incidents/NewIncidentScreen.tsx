import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Platform,
  Modal,
  Dimensions,
  Image,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { v4 as uuidv4 } from 'uuid';

import { createIncident } from '../../database/incidents-db';
import { createPhoto } from '../../database/photos-db';
import { addToSyncQueue } from '../../database/sync-queue';
import { useSyncStore } from '../../stores/sync.store';
import { IncidentStatus, PriorityLevel } from '../../types/database';

import type { MaterialIcons as MaterialIconsType } from '@expo/vector-icons';
const SITUATION_TYPES: { icon: React.ComponentProps<typeof MaterialIconsType>['name']; label: string; value: string }[] = [
  { icon: 'car-crash', label: 'Vehicle Accident', value: 'Vehicle Accident' },
  { icon: 'personal-injury', label: 'Injury / Trauma', value: 'Injury / Trauma' },
  { icon: 'favorite', label: 'Medical Emergency', value: 'Medical Emergency' },
  { icon: 'local-fire-department', label: 'Fire / Burns', value: 'Fire / Burns' },
];

const { width, height } = Dimensions.get('window');

export function NewIncidentScreen() {
  const navigation = useNavigation();
  const [situation, setSituation] = useState<string>('');
  const [address, setAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [casualties, setCasualties] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 1.3521, // Default Singapore
    longitude: 103.8198,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [photos, setPhotos] = useState<{ uri: string; caption: string }[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  const { sync } = useSyncStore();

  // Auto-get location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }
      
      // Get high accuracy location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = location.coords;
      setLatitude(latitude);
      setLongitude(longitude);
      
      // Try to get address from coordinates
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          const addressParts = [
            place.name,
            place.street,
            place.district,
            place.city,
            place.region,
          ].filter(Boolean);
          
          const formattedAddress = addressParts.join(', ');
          setAddress(formattedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } else {
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      } catch (geoError) {
        // If geocoding fails, use coordinates
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get location. Please enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const openMap = () => {
    if (latitude && longitude) {
      const url = Platform.select({
        ios: `maps:${latitude},${longitude}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
      });
      if (url) Linking.openURL(url);
    } else {
      Alert.alert('No location', 'Please get location first');
    }
  };

  const handleVoiceInput = async () => {
    if (isRecording) {
      // Stop recording - expo-speech doesn't have native speech-to-text
      // We'll use a workaround with voice recognition
      setIsRecording(false);
      return;
    }

    // Check if speech recognition is available
    const available = await Speech.getAvailableVoicesAsync();
    
    // For now, we'll use a simple workaround
    // In production, you'd want to use expo-speech-recognition or similar
    Alert.alert(
      'Voice Input',
      'Tap the buttons below to add common phrases:\n\n' +
      '"Multiple casualties at scene"\n' +
      '"Patient unconscious"\n' +
      '"Heavy bleeding observed"\n' +
      '"Fire hazard present"',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsRecording(false) },
        { 
          text: 'Multiple casualties', 
          onPress: () => {
            setNotes(prev => prev + (prev ? '\n' : '') + 'Multiple casualties at scene. ');
            setIsRecording(false);
          }
        },
        { 
          text: 'Patient unconscious', 
          onPress: () => {
            setNotes(prev => prev + (prev ? '\n' : '') + 'Patient unconscious. ');
            setIsRecording(false);
          }
        },
        { 
          text: 'Heavy bleeding', 
          onPress: () => {
            setNotes(prev => prev + (prev ? '\n' : '') + 'Heavy bleeding observed. ');
            setIsRecording(false);
          }
        },
      ]
    );
    setIsRecording(true);
  };

  // Photo handling functions
  const takePhoto = async () => {
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
      setPhotos([...photos, { uri: result.assets[0].uri, caption: '' }]);
    }
  };

  const selectPhotoFromLibrary = async () => {
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
      setPhotos([...photos, { uri: result.assets[0].uri, caption: '' }]);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
    setPhotoModalVisible(false);
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    const newPhotos = [...photos];
    newPhotos[index].caption = caption;
    setPhotos(newPhotos);
  };

  const openPhotoModal = (index: number) => {
    setSelectedPhotoIndex(index);
    setPhotoModalVisible(true);
  };

  const openMapSelector = () => {
    // Set map to current location if available
    if (latitude && longitude) {
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
    setMapVisible(true);
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    setLatitude(coordinate.latitude);
    setLongitude(coordinate.longitude);
    
    // Try to get address for the selected coordinate
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const addressParts = [
          place.name,
          place.street,
          place.district,
          place.city,
          place.region,
        ].filter(Boolean);
        setAddress(addressParts.join(', '));
      } else {
        setAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      }
    } catch (error) {
      setAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
    }
  };

  const confirmMapSelection = () => {
    setMapVisible(false);
  };

  const adjustCasualty = (type: keyof typeof casualties, delta: number) => {
    setCasualties(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
  };

  const handleCreate = async () => {
    if (!situation) {
      Alert.alert('Error', 'Please select a situation type');
      return;
    }
    if (!address) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    setCreating(true);
    try {
      // Determine priority based on casualty count
      let priority: PriorityLevel = 'non_urgent';
      if (casualties.red > 0) priority = 'critical';
      else if (casualties.yellow > 0) priority = 'urgent';

      // Build scene description with casualty estimate
      const casualtyEstimate = `Initial Casualty Estimate: RED: ${casualties.red}, YELLOW: ${casualties.yellow}, GREEN: ${casualties.green}, BLACK: ${casualties.black}`;
      const fullSceneDescription = notes 
        ? `${notes}\n\n${casualtyEstimate}` 
        : casualtyEstimate;

      // Create incident locally with all data
      const incident = await createIncident({
        incident_number: `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        address,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        location_description: address,
        status: 'on_scene' as IncidentStatus,
        priority,
        chief_complaint: situation,
        scene_description: fullSceneDescription,
        local_id: uuidv4(),
        device_id: 'mobile-device',
      });

      // Add to sync queue
      await addToSyncQueue('incidents', incident.id, 'CREATE', {
        incident_number: incident.incident_number,
        address,
        latitude,
        longitude,
        location_description: address,
        status: 'on_scene',
        priority,
        chief_complaint: situation,
        scene_description: fullSceneDescription,
        local_id: incident.local_id,
      });

      // Trigger immediate sync (fire and forget - don't block navigation)
      sync().then(result => {
        if (result.success) {
          console.log('Auto-sync completed successfully');
        } else {
          console.log('Auto-sync had errors:', result.errors);
        }
      }).catch(err => {
        console.log('Auto-sync failed:', err.message);
      });

      // Save photos if any
      if (photos.length > 0) {
        for (const photo of photos) {
          const photoRecord = await createPhoto({
            incident_id: incident.id,
            uri: photo.uri,
            caption: photo.caption,
            taken_at: new Date().toISOString(),
          });

          // Add photo to sync queue
          await addToSyncQueue('photos', photoRecord.id, 'CREATE', {
            incident_id: incident.id,
            uri: photo.uri,
            caption: photo.caption,
            taken_at: photoRecord.taken_at,
          });
        }
      }

      // Reset navigation stack to Main (Home) and navigate to IncidentDetail
      // This ensures back button from IncidentDetail goes to Home, not the form
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Main' as never },
          { name: 'IncidentDetail' as never, params: { incidentId: incident.id } },
        ],
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create incident');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log New Incident</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Situation Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. Situation Type *</Text>
          <View style={styles.situationGrid}>
            {SITUATION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.situationCard,
                  situation === type.value && styles.situationCardActive,
                ]}
                onPress={() => setSituation(type.value)}
              >
                <MaterialIcons
                  name={type.icon}
                  size={28}
                  color={situation === type.value ? '#dc2626' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.situationLabel,
                    situation === type.value && styles.situationLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. Location *</Text>
          
          {/* Location Display */}
          <View style={styles.locationContainer}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              placeholder="Detecting location..."
              placeholderTextColor="#6b7280"
              value={address}
              onChangeText={setAddress}
              multiline
            />
            
            {/* Location Actions */}
            <View style={styles.locationActions}>
              <TouchableOpacity
                style={styles.locationActionBtn}
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                <MaterialIcons
                  name={locationLoading ? 'location-searching' : 'gps-fixed'}
                  size={20}
                  color="#dc2626"
                />
                <Text style={styles.locationActionText}>
                  {locationLoading ? 'Detecting...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.locationActionBtn}
                onPress={openMapSelector}
              >
                <MaterialIcons name="edit-location-alt" size={20} color="#dc2626" />
                <Text style={styles.locationActionText}>Select on Map</Text>
              </TouchableOpacity>
              
              {latitude && longitude && (
                <TouchableOpacity
                  style={styles.locationActionBtn}
                  onPress={openMap}
                >
                  <MaterialIcons name="map" size={20} color="#dc2626" />
                  <Text style={styles.locationActionText}>View Map</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Coordinates Display */}
            {latitude && longitude && (
              <Text style={styles.coordinatesText}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
            )}
          </View>
        </View>

        {/* Casualties - Initial Estimate */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>3. Initial Casualty Estimate</Text>
          <Text style={styles.casualtySubtitle}>
            First arrival estimate - will be compared with actual patient count
          </Text>
          <View style={styles.casualtiesGrid}>
            {[
              { key: 'red', label: 'RED', color: '#dc2626', desc: 'Critical' },
              { key: 'yellow', label: 'YELLOW', color: '#f59e0b', desc: 'Urgent' },
              { key: 'green', label: 'GREEN', color: '#16a34a', desc: 'Minor' },
              { key: 'black', label: 'BLACK', color: '#6b7280', desc: 'Deceased' },
            ].map((item) => (
              <View key={item.key} style={styles.casualtyCard}>
                <Text style={[styles.casualtyLabel, { color: item.color }]}>
                  {item.label}
                </Text>
                <Text style={styles.casualtyDesc}>{item.desc}</Text>
                <View style={styles.casualtyControls}>
                  <TouchableOpacity
                    style={styles.casualtyButton}
                    onPress={() => adjustCasualty(item.key as any, -1)}
                  >
                    <Text style={styles.casualtyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.casualtyCount}>
                    {casualties[item.key as keyof typeof casualties]}
                  </Text>
                  <TouchableOpacity
                    style={styles.casualtyButton}
                    onPress={() => adjustCasualty(item.key as any, 1)}
                  >
                    <Text style={styles.casualtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          
          {/* Summary */}
          <View style={styles.casualtySummary}>
            <Text style={styles.casualtySummaryText}>
              Total Estimated: {casualties.red + casualties.yellow + casualties.green + casualties.black}
            </Text>
          </View>
        </View>

        {/* Scene Notes with Voice Input */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionLabel}>Scene Notes</Text>
            <TouchableOpacity 
              style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
              onPress={handleVoiceInput}
            >
              <MaterialIcons 
                name={isRecording ? 'mic' : 'mic-none'} 
                size={20} 
                color={isRecording ? '#dc2626' : '#9ca3af'} 
              />
              <Text style={[styles.voiceText, isRecording && styles.voiceTextActive]}>
                {isRecording ? 'Recording...' : 'Voice'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Describe what you found on arrival..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Photos Section */}
        <View style={styles.section}>
          <View style={styles.photosHeader}>
            <Text style={styles.sectionLabel}>Scene Photos ({photos.length})</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                <MaterialIcons name="camera-alt" size={20} color="#fff" />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={selectPhotoFromLibrary}>
                <MaterialIcons name="photo-library" size={20} color="#fff" />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {photos.length > 0 && (
            <FlatList
              data={photos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.photoThumbnail}
                  onPress={() => openPhotoModal(index)}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                  {item.caption ? (
                    <View style={styles.captionOverlay}>
                      <Text style={styles.captionText} numberOfLines={1}>{item.caption}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.photosList}
            />
          )}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={creating}
        >
          <Text style={styles.createButtonText}>
            {creating ? 'CREATING...' : 'CREATE CASE'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Modal for Location Selection */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.mapModalContainer}>
          {/* Header - Fixed at top */}
          <SafeAreaView style={styles.mapHeaderSafeArea}>
            <View style={styles.mapHeader}>
              <TouchableOpacity 
                style={styles.mapHeaderButton}
                onPress={() => setMapVisible(false)}
              >
                <MaterialIcons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.mapHeaderTitle}>Select Location</Text>
              <TouchableOpacity 
                style={[styles.mapHeaderButton, styles.mapConfirmButton]}
                onPress={confirmMapSelection}
              >
                <Text style={styles.mapConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          
          {/* Map - Takes remaining space */}
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={handleMapPress}
          >
            {latitude && longitude && (
              <Marker
                coordinate={{ latitude, longitude }}
                draggable
                onDragEnd={handleMapPress}
                pinColor="#dc2626"
              />
            )}
          </MapView>
          
          {/* Footer - Fixed at bottom */}
          <SafeAreaView style={styles.mapFooterSafeArea}>
            <View style={styles.mapFooter}>
              <Text style={styles.mapInstructions}>
                Tap anywhere to place a marker • Drag to adjust
              </Text>
              {address ? (
                <View style={styles.selectedLocationBox}>
                  <MaterialIcons name="location-on" size={20} color="#dc2626" />
                  <Text style={styles.mapAddress} numberOfLines={2}>{address}</Text>
                </View>
              ) : (
                <Text style={styles.mapNoLocation}>Tap on map to select location</Text>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Photo Modal */}
      <Modal
        visible={photoModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <SafeAreaView style={styles.photoModalContainer}>
          {/* Header */}
          <View style={styles.photoModalHeader}>
            <TouchableOpacity onPress={() => setPhotoModalVisible(false)}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.photoModalTitle}>
              Photo {selectedPhotoIndex !== null ? selectedPhotoIndex + 1 : ''} of {photos.length}
            </Text>
            <TouchableOpacity 
              onPress={() => selectedPhotoIndex !== null && removePhoto(selectedPhotoIndex)}
            >
              <MaterialIcons name="delete" size={24} color="#dc2626" />
            </TouchableOpacity>
          </View>

          {/* Photo */}
          {selectedPhotoIndex !== null && (
            <>
              <View style={styles.photoModalImageContainer}>
                <Image 
                  source={{ uri: photos[selectedPhotoIndex].uri }} 
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              </View>

              {/* Caption Input */}
              <View style={styles.photoModalFooter}>
                <Text style={styles.captionLabel}>Caption</Text>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add a description..."
                  placeholderTextColor="#6b7280"
                  value={photos[selectedPhotoIndex].caption}
                  onChangeText={(text) => updatePhotoCaption(selectedPhotoIndex, text)}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </>
          )}
        </SafeAreaView>
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
  situationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  situationCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  situationCardActive: {
    borderColor: '#dc2626',
  },
  situationLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  situationLabelActive: {
    color: '#dc2626',
  },
  locationContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  locationInput: {
    marginBottom: 12,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  locationActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  locationActionText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  coordinatesText: {
    color: '#6b7280',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  voiceButtonActive: {
    backgroundColor: '#dc262620',
  },
  voiceText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceTextActive: {
    color: '#dc2626',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  casualtySubtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 12,
  },
  casualtiesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  casualtyCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  casualtyLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  casualtyDesc: {
    color: '#6b7280',
    fontSize: 9,
    marginBottom: 8,
  },
  casualtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  casualtyButton: {
    width: 28,
    height: 28,
    backgroundColor: '#0f0f0f',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casualtyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  casualtyCount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  casualtySummary: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    alignItems: 'center',
  },
  casualtySummaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#dc2626',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Map Modal Styles
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  mapHeaderSafeArea: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingTop: Platform.OS === 'ios' ? 16 : (StatusBar.currentHeight || 8),
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    minHeight: 56,
  },
  mapHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
  },
  mapConfirmButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  mapConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
    width: width,
  },
  mapFooterSafeArea: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  mapFooter: {
    padding: 16,
  },
  mapInstructions: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  selectedLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  mapAddress: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
  mapNoLocation: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Photos Section
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photosList: {
    paddingVertical: 4,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
  },
  captionText: {
    color: '#fff',
    fontSize: 10,
  },
  
  // Photo Modal
  photoModalContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  photoModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  photoModalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
  },
  photoModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  captionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  captionInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top',
  },
});
