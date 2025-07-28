import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Deal() {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOpportunity = async () => {
      if (!opportunityId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('opportunities')
          .select('*')
          .eq('id', opportunityId)
          .single();
        
        if (error) throw error;
        setOpportunity(data);
      } catch (err) {
        toast.error("Failed to load opportunity details", { description: (err as Error).message });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunity();
  }, [opportunityId, navigate]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-1/2" />
        <div className="grid grid-cols-2 gap-6 pt-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Opportunity not found</h2>
        <Button variant="link" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-white">{opportunity.company_name}</h1>
        <p className="text-xl text-primary mt-1">
          {opportunity.role}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card p-4 rounded-lg border">Propensity Analysis (Coming Soon)</div>
            <div className="bg-card p-4 rounded-lg border">Enriched Deal Intelligence (Coming Soon)</div>
          </div>
          <div className="space-y-6">
            <div className="bg-card p-4 rounded-lg border">Contacts (Coming Soon)</div>
            <div className="bg-card p-4 rounded-lg border">Actions (Coming Soon)</div>
          </div>
        </div>
      </div>
    </div>
  );
}