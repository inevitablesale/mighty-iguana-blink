import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  calendly_url: string | null;
  email?: string | null; // Add email to profile
}

export function useUserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        setProfile({ id: user.id, first_name: '', last_name: '', calendly_url: '', email: user.email });
      } else if (data) {
        setProfile({ ...data, email: user.email });
      } else {
        setProfile({ id: user.id, first_name: '', last_name: '', calendly_url: '', email: user.email });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null);
        fetchProfile();
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return { user, profile, loading, refresh: fetchProfile };
}