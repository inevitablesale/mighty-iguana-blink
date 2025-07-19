import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Spline } from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="coogi-gradient-bg flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Spline className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Coogi</h1>
          </div>
          <CardDescription>Weaving together the best opportunities.</CardDescription>
        </CardHeader>
        <CardContent>
          <div id="login-auth-form">
            <Auth
              supabaseClient={supabase}
              appearance={{}}
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