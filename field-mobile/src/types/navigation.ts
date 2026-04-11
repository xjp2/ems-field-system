import { NavigatorScreenParams } from '@react-navigation/native';
import { Incident, Patient } from './database';

// Auth stack navigator params
export type AuthStackParamList = {
  Login: undefined;
};

// Main tab navigator params
export type MainTabParamList = {
  Home: undefined;
  ActiveCase: undefined;
  Patients: undefined;
};

// Root stack navigator params (includes modals)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  
  // Modal screens
  NewIncident: undefined;
  IncidentDetail: { incidentId: string };
  NewPatient: { incidentId: string };
  PatientDetail: { patientId: string; incidentId: string };
  AddVital: { patientId: string; incidentId: string };
  AddIntervention: { patientId: string; incidentId: string };
};

// Navigation prop types for type-safe navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
