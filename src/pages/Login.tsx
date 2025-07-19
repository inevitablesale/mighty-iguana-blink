import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SweaterIcon } from '@/components/SweaterIcon';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const Login = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/');
      } catch (error) {
        toast.error('Failed to check session');
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate('/');
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) return null;

  return (
    <div className="coogi-gradient-bg flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <SweaterIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Coogi</h1>
          </div>
          <CardDescription>AI-powered recruiting intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          <div id="login-auth-form">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: 'hsl(var(--primary))',
                      brandAccent: 'hsl(var(--primary-foreground))',
                    },
                  },
                },
              }}
              providers={[]}
              theme="dark"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;