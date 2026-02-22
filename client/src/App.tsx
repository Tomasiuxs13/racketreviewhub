import { Switch, Route, useLocation } from "wouter";
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
import ComparisonPage from "@/pages/ComparisonPage";
import QuizPage from "@/pages/QuizPage";
import NotFound from "@/pages/not-found";
import { AuthGuard } from "@/components/AuthGuard";
import { CompareBar } from "@/components/CompareBar";
import { SUPPORTED_LOCALES } from "@/i18n/I18nProvider";

// Build locale-prefixed route patterns for all non-English locales
// e.g. "/es", "/es/rackets", "/es/rackets/:id", etc.
function LocalePrefixedRoutes() {
  return (
    <>
      {SUPPORTED_LOCALES.filter((l) => l !== "en").map((locale) => (
        <Switch key={locale}>
          <Route path={`/${locale}`} component={HomePage} />
          <Route path={`/${locale}/rackets`} component={RacketsPage} />
          <Route path={`/${locale}/rackets/:id`} component={RacketDetailPage} />
          <Route path={`/${locale}/guides`} component={GuidesPage} />
          <Route path={`/${locale}/guides/:slug`} component={GuideDetailPage} />
          <Route path={`/${locale}/brands`} component={BrandsPage} />
          <Route path={`/${locale}/brands/:slug`} component={BrandDetailPage} />
          <Route path={`/${locale}/blog`} component={BlogPage} />
          <Route path={`/${locale}/blog/:slug`} component={BlogPostPage} />
          <Route path={`/${locale}/compare/:ids`} component={ComparisonPage} />
          <Route path={`/${locale}/quiz`} component={QuizPage} />
          <Route path={`/${locale}/authors/:slug`} component={AuthorPage} />
        </Switch>
      ))}
    </>
  );
}

function Router() {
  return (
    <Switch>
      {/* English (default) routes */}
      <Route path="/" component={HomePage} />
      <Route path="/rackets" component={RacketsPage} />
      <Route path="/rackets/:id" component={RacketDetailPage} />
      <Route path="/guides" component={GuidesPage} />
      <Route path="/guides/:slug" component={GuideDetailPage} />
      <Route path="/brands" component={BrandsPage} />
      <Route path="/brands/:slug" component={BrandDetailPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/compare/:ids" component={ComparisonPage} />
      <Route path="/quiz" component={QuizPage} />
      <Route path="/authors/:slug" component={AuthorPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/admin">
        <AuthGuard requireAdmin>
          <AdminPage />
        </AuthGuard>
      </Route>
      {/* Locale-prefixed routes for all supported non-English locales */}
      <Route>
        <LocalePrefixedRoutes />
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
          <CompareBar />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
