import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Trophy, Target } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="font-heading font-bold text-5xl md:text-7xl mb-6">
          Expert Padel Racket Reviews
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          AI-powered comprehensive reviews, performance ratings, and expert recommendations to help you find your perfect padel racket.
        </p>
        <Button 
          size="lg" 
          onClick={handleLogin}
          className="text-lg px-8 py-6"
          data-testid="button-login"
        >
          Sign In to Access Admin Panel
        </Button>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-xl mb-3">AI-Powered Content</h3>
              <p className="text-muted-foreground">
                Generate professional racket reviews and ratings automatically using advanced AI technology.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-xl mb-3">Expert Ratings</h3>
              <p className="text-muted-foreground">
                Detailed performance breakdowns for power, control, rebound, maneuverability, and sweet spot.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-xl mb-3">Complete Management</h3>
              <p className="text-muted-foreground">
                Full admin dashboard to manage rackets, reviews, affiliate links, and pricing information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Sign in to access the admin panel and start creating professional padel racket reviews.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={handleLogin}
              className="text-lg px-8 py-6"
              data-testid="button-login-cta"
            >
              Access Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
