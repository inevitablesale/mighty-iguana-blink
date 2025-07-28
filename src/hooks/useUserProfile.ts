import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  calendly_url: string | null;
}

export interface UserCredits {
  contact_credits: number;
  export_credits: number;
}

export function useUserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndCredits = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const [profileRes, creditsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('credits').select('*').eq('user_id', user.id).single()
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileRes.error);
      } else {
        setProfile(profileRes.data);
      }

      if (creditsRes.error && creditsRes.error.code !== 'PGRST116') {
        console.error('Error fetching credits:', creditsRes.error);
      } else {
        setCredits(creditsRes.data);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfileAndCredits();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null);
        fetchProfileAndCredits();
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setCredits(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfileAndCredits]);

  return { user, profile, credits, loading, refresh: fetchProfileAndCredits };
}