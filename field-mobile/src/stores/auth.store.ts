import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthUser } from '../types/database';
import { supabase } from '../config/supabase';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      // Login with email/password
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) throw error;
          
          if (data.session && data.user) {
            // Get user roles from app_metadata
            const roles = data.user.app_metadata?.roles || ['FIELD'];
            
            const authUser: AuthUser = {
              id: data.user.id,
              email: data.user.email!,
              roles,
              jwt: data.session.access_token,
            };
            
            set({
              user: authUser,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },
      
      // Logout
      logout: async () => {
        set({ isLoading: true });
        
        try {
          await supabase.auth.signOut();
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },
      
      // Restore session on app start
      restoreSession: async () => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (data.session && data.session.user) {
            const user = data.session.user;
            const roles = user.app_metadata?.roles || ['FIELD'];
            
            const authUser: AuthUser = {
              id: user.id,
              email: user.email!,
              roles,
              jwt: data.session.access_token,
            };
            
            set({
              user: authUser,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          set({ isLoading: false });
        }
      },
      
      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage({
        getItem: async (name) => {
          const value = await SecureStore.getItemAsync(name);
          return value;
        },
        setItem: async (name, value) => {
          await SecureStore.setItemAsync(name, value);
        },
        removeItem: async (name) => {
          await SecureStore.deleteItemAsync(name);
        },
      }),
    }
  )
);
