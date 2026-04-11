import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { checkApiHealth } from '../config/api';
import { useSyncStore } from '../stores/sync.store';

export function ConnectionStatus() {
  const [health, setHealth] = useState<{ ok: boolean; checking: boolean }>({
    ok: false,
    checking: true,
  });
  const { isOnline, pendingCount } = useSyncStore();

  const checkHealth = async () => {
    setHealth({ ok: false, checking: true });
    const result = await checkApiHealth();
    setHealth({ ok: result.ok, checking: false });
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Determine status
  let status: 'connected' | 'offline' | 'error' = 'connected';
  if (!isOnline) status = 'offline';
  else if (!health.ok && !health.checking) status = 'error';

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: 'cloud-done',
          color: '#16a34a',
          text: pendingCount > 0 ? `${pendingCount} pending` : 'Synced',
        };
      case 'offline':
        return {
          icon: 'cloud-off',
          color: '#9ca3af',
          text: 'Offline',
        };
      case 'error':
        return {
          icon: 'cloud-off',
          color: '#dc2626',
          text: 'Sync Error',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: `${config.color}20` }]}
      onPress={checkHealth}
      disabled={health.checking}
    >
      <MaterialIcons 
        name={config.icon} 
        size={16} 
        color={config.color} 
      />
      <Text style={[styles.text, { color: config.color }]}>
        {health.checking ? 'Checking...' : config.text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
