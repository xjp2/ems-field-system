import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';

import { AppNavigator } from './src/navigation/AppNavigator';
import { initializeDatabase } from './src/database/db-schema';
import { useSyncStore } from './src/stores/sync.store';

// Initialize database on app start
let dbInitialized = false;

async function initDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
    console.log('Database initialized');
  }
}

export default function App() {
  const { sync, setOnline, updateStatus } = useSyncStore();

  // Initialize database and sync on mount
  useEffect(() => {
    initDb();
    updateStatus();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - sync
        sync();
        updateStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sync, updateStatus]);

  // Handle network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });

    return () => {
      unsubscribe();
    };
  }, [setOnline]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
