import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile';
import { SweaterIcon } from '@/components/SweaterIcon';

const TheLoom = () => {
  const [opportunityCount, setOpportunityCount] = useState(0);
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOppCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [oppsRes, campaignsRes] = await Promise.all([
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('campaigns').select('opportunity_id').eq('user_id', user.id)
      ]);

      const processedOppIds = new Set(campaignsRes.data?.map(c => c.opportunity_id).filter(Boolean) || []);
      const totalOpps = oppsRes.count || 0;
      
      // This is a simplified count. We'd need to fetch all opps to filter accurately.
      // For now, we'll simulate having unreviewed opportunities if the counts differ.
      const unreviewedCount = totalOpps - processedOppIds.size;
      setOpportunityCount(Math.max(0, unreviewedCount));
    };

    fetchOppCount();
    const interval = setInterval(fetchOppCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const greeting = profile?.first_name ? `Welcome back, ${profile.first_name}` : "Welcome to The Loom";

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <ParticleBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-4">
          <SweaterIcon className="h-16 w-16 text-primary" />
          <h1 className="text-6xl font-bold tracking-tighter">Coogi</h1>
        </div>
        <p className="mt-2 text-lg text-muted-foreground">Weaving together the best opportunities.</p>
        
        <p className="mt-12 text-2xl font-light">{greeting}</p>

        <motion.div
          animate={{
            scale: opportunityCount > 0 ? [1, 1.05, 1] : 1,
            boxShadow: opportunityCount > 0 
              ? '0 0 30px hsl(var(--secondary) / 0.5)' 
              : '0 0 0px hsl(var(--secondary) / 0)',
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-8 inline-block rounded-full"
        >
          <Button 
            size="lg" 
            className="h-16 rounded-full px-8 text-lg coogi-gradient-bg text-primary-foreground hover:opacity-90 transition-all duration-300"
            onClick={() => navigate('/opportunities')}
          >
            {opportunityCount > 0 
              ? `Review ${opportunityCount} New Opportunit${opportunityCount > 1 ? 'ies' : ''}`
              : 'Go to Command Center'}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default TheLoom;