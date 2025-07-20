import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const Profile = () => {
  const { user, profile, loading, refresh } = useUserProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [extensionId, setExtensionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setCalendlyUrl(profile.calendly_url || '');
    }
    const storedExtensionId = localStorage.getItem('coogiExtensionId');
    if (storedExtensionId) {
      setExtensionId(storedExtensionId);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    localStorage.setItem('coogiExtensionId', extensionId);

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
      toast.success('Profile and Extension ID saved!');
      refresh();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Profile" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Profile" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile & Integrations</CardTitle>
            <CardDescription>Update your personal information and connect your tools.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="extensionId">Chrome Extension ID</Label>
              <Input id="extensionId" value={extensionId} onChange={(e) => setExtensionId(e.target.value)} placeholder="Paste your extension ID here" />
              <p className="text-sm text-muted-foreground">
                Find this on the <code>chrome://extensions</code> page. Make sure Developer Mode is on.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Profile;