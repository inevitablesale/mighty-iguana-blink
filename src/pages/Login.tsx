import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { SweaterIcon } from '@/components/SweaterIcon';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const Login = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This effect now only checks if a session already exists on initial load.
    // The onAuthStateChange listener in App.tsx handles the redirect automatically.
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        // If a session exists, the App component will handle the redirect.
        // We just need to stop showing the loading state.
        if (!session) {
          setLoading(false);
        }
      } catch (error) {
        toast.error('Failed to check session');
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  if (loading) return null;

  return (
    <div className="coogi-gradient-bg flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <SweaterIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Coogi</h1>
          </div>
          <CardDescription>Weaving together the best opportunities.</CardDescription>
        </CardHeader>
        <CardContent>
          <div id="login-auth-form">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
              }}
              providers={[]}
              theme="light"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;