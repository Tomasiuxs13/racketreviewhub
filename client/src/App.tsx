import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Pages
import HomePage from "@/pages/HomePage";
import RacketsPage from "@/pages/RacketsPage";
import RacketDetailPage from "@/pages/RacketDetailPage";
import GuidesPage from "@/pages/GuidesPage";
import GuideDetailPage from "@/pages/GuideDetailPage";
import BrandsPage from "@/pages/BrandsPage";
import BrandDetailPage from "@/pages/BrandDetailPage";
import BlogPage from "@/pages/BlogPage";
import BlogPostPage from "@/pages/BlogPostPage";
import AuthorPage from "@/pages/AuthorPage";
import AdminPage from "@/pages/AdminPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import NotFound from "@/pages/not-found";
import { AuthGuard } from "@/components/AuthGuard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/rackets" component={RacketsPage} />
      <Route path="/rackets/:id" component={RacketDetailPage} />
      <Route path="/guides" component={GuidesPage} />
      <Route path="/guides/:slug" component={GuideDetailPage} />
      <Route path="/brands" component={BrandsPage} />
      <Route path="/brands/:slug" component={BrandDetailPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/authors/:slug" component={AuthorPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/admin">
        <AuthGuard requireAdmin>
          <AdminPage />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">
            <Router />
          </main>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
