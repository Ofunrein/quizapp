import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase credentials are configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key';

// Create Supabase client only if properly configured
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Make supabase available for debugging (development only)
if (typeof window !== 'undefined' && import.meta.env.DEV && supabase) {
  window.supabase = supabase;
}

// Helper functions for auth
export const auth = {
  signUp: async (email, password) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  signIn: async (email, password) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getUser: async () => {
    if (!supabase) {
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange: (callback) => {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  }
}; 