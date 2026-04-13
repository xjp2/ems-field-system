import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { MainTabParamList, RootStackParamList } from '../types/navigation';

// Screens
import { HomeScreen } from '../screens/home/HomeScreen';
import { NewIncidentScreen } from '../screens/incidents/NewIncidentScreen';
import { IncidentDetailScreen } from '../screens/incidents/IncidentDetailScreen';
import { NewPatientScreen } from '../screens/patients/NewPatientScreen';
import { PatientDetailScreen } from '../screens/patients/PatientDetailScreen';
import { AddVitalScreen } from '../screens/patients/AddVitalScreen';
import { AddInterventionScreen } from '../screens/patients/AddInterventionScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Tab bar icon helper
function TabIcon({ name, color }: { name: string; color: string }) {
  return <MaterialIcons name={name} size={24} color={color} />;
}

// Main tabs navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#2a2a2a',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#dc2626',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Active',
          tabBarIcon: ({ color }) => TabIcon({ name: 'medical-services', color }),
        }}
      />
    </Tab.Navigator>
  );
}

// Main stack navigator (tabs + modals)
export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      
      {/* Modal screens */}
      <Stack.Screen
        name="NewIncident"
        component={NewIncidentScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="IncidentDetail"
        component={IncidentDetailScreen}
      />
      <Stack.Screen
        name="NewPatient"
        component={NewPatientScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
      />
      <Stack.Screen
        name="AddVital"
        component={AddVitalScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="AddIntervention"
        component={AddInterventionScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}
