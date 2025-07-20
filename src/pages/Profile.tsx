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
import { CheckCircle, XCircle } from 'lucide-react';

const Profile = () => {
  const { user, profile, loading, refresh } = useUserProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setCalendlyUrl(profile.calendly_url || '');
    }
    
    const checkExtension = () => {
      const storedExtensionId = localStorage.getItem('coogiExtensionId');
      setExtensionId(storedExtensionId);
    }
    checkExtension();

    // The 'storage' event fires when another tab changes localStorage.
    // We also need to listen for our custom event for same-tab updates.
    window.addEventListener('storage', checkExtension);
    window.addEventListener('coogi-extension-ready', checkExtension);

    return () => {
      window.removeEventListener('storage', checkExtension);
      window.removeEventListener('coogi-extension-ready', checkExtension);
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
      toast.success('Profile saved!');
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
              <Label>Chrome Extension Status</Label>
              <div className={`flex items-center gap-3 rounded-md border p-3 ${extensionId ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}>
                {extensionId ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-300">Connected</p>
                      <p className="text-sm text-green-700 dark:text-green-400">ID: <code className="text-xs rounded bg-green-200/50 px-1 py-0.5 dark:bg-green-800/50">{extensionId}</code></p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300">Not Detected</p>
                      <p className="text-sm text-red-700 dark:text-red-400">Ensure the extension is installed and enabled.</p>
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                The web app automatically detects the extension. No manual entry needed.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Profile;