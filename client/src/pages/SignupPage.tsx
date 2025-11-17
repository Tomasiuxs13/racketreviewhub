import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SignupPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      setLocation("/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Registration Closed</CardTitle>
          <CardDescription>New account registration is not available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Registration Unavailable</AlertTitle>
            <AlertDescription>
              Account registration is currently closed. If you have an existing account, please use the login page.
              You will be redirected to the login page shortly.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
