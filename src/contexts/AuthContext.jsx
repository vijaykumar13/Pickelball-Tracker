import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Save or update user profile in Supabase
const saveUserProfile = async (user) => {
  if (!user) return;

  const { id, email, user_metadata } = user;
  const fullName = user_metadata?.full_name || user_metadata?.name || '';
  const avatarUrl = user_metadata?.avatar_url || user_metadata?.picture || '';

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: id,
        email: email,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error saving user profile:', error);
    }
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        saveUserProfile(currentUser);
      }
      setLoading(false);
    };

    getSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Save profile on sign in
        if (event === 'SIGNED_IN' && currentUser) {
          saveUserProfile(currentUser);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
    });
    if (error) {
      console.error('Error signing in with Facebook:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUp = async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });
    if (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      // Force clear user state
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      // Force clear user state even on error
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithFacebook,
    signInWithEmail,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
