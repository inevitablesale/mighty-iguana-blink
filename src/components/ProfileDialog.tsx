import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileDialog() {
  const { user, profile, loading, refresh } = useUserProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setCalendlyUrl(profile.calendly_url || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ 
        first_name: firstName, 
        last_name: lastName, 
        calendly_url: calendlyUrl,
      })
      .eq('id', user.id);

    setIsSaving(false);
    if (error) {
      toast.error('Failed to update profile.');
      console.error('Error updating profile:', error);
    } else {
      toast.success('Profile updated successfully!');
      refresh();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal information and connect your tools.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendlyUrl">Calendly URL</Label>
              <Input id="calendlyUrl" value={calendlyUrl} onChange={(e) => setCalendlyUrl(e.target.value)} placeholder="https://calendly.com/your-name" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving || loading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}