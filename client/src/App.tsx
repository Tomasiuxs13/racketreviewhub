import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

import { lazy, Suspense, useEffect } from "react";

// Eager pages — primary SEO entry points (avoid a chunk-load waterfall on landing)
import HomePage from "@/pages/HomePage";
import RacketsPage from "@/pages/RacketsPage";
import RacketDetailPage from "@/pages/RacketDetailPage";

// Lazy pages — split into per-route chunks to keep the main bundle small
const GuidesPage = lazy(() => import("@/pages/GuidesPage"));
const GuideDetailPage = lazy(() => import("@/pages/GuideDetailPage"));
const BrandsPage = lazy(() => import("@/pages/BrandsPage"));
const BrandDetailPage = lazy(() => import("@/pages/BrandDetailPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const AuthorPage = lazy(() => import("@/pages/AuthorPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ComparisonPage = lazy(() => import("@/pages/ComparisonPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const BestOfPage = lazy(() => import("@/pages/BestOfPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const MethodologyPage = lazy(() => import("@/pages/MethodologyPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const NotFound = lazy(() => import("@/pages/not-found"));
import { AuthGuard } from "@/components/AuthGuard";
import { CompareBar } from "@/components/CompareBar";
import { CompareProvider } from "@/hooks/useCompare";
import { SUPPORTED_LOCALES } from "@/i18n/I18nProvider";



/**
 * Reset scroll position on every route change. Without this, SPA navigations
 * keep the previous page's scroll offset (e.g. opening a racket from a
 * scrolled listing landed mid-page on Performance Metrics).
 */
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={null}>
    <ScrollToTop />
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
      <Route path="/compare" component={ComparisonPage} />
      <Route path="/compare/:ids" component={ComparisonPage} />
      <Route path="/quiz" component={QuizPage} />
      <Route path="/best/:category" component={BestOfPage} />
      <Route path="/authors/:slug" component={AuthorPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/methodology" component={MethodologyPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/privacy">
        <LegalPage type="privacy" />
      </Route>
      <Route path="/terms">
        <LegalPage type="terms" />
      </Route>
      <Route path="/disclosure">
        <LegalPage type="disclosure" />
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/admin">
        <AuthGuard requireAdmin>
          <AdminPage />
        </AuthGuard>
      </Route>

      {/* Locale-prefixed routes for all supported non-English locales */}
      {SUPPORTED_LOCALES.filter((l) => l !== "en").flatMap((locale) => [
        <Route key={`${locale}-home`} path={`/${locale}`} component={HomePage} />,
        <Route key={`${locale}-rackets`} path={`/${locale}/rackets`} component={RacketsPage} />,
        <Route key={`${locale}-racket`} path={`/${locale}/rackets/:id`} component={RacketDetailPage} />,
        <Route key={`${locale}-guides`} path={`/${locale}/guides`} component={GuidesPage} />,
        <Route key={`${locale}-guide`} path={`/${locale}/guides/:slug`} component={GuideDetailPage} />,
        <Route key={`${locale}-brands`} path={`/${locale}/brands`} component={BrandsPage} />,
        <Route key={`${locale}-brand`} path={`/${locale}/brands/:slug`} component={BrandDetailPage} />,
        <Route key={`${locale}-blog`} path={`/${locale}/blog`} component={BlogPage} />,
        <Route key={`${locale}-post`} path={`/${locale}/blog/:slug`} component={BlogPostPage} />,
        <Route key={`${locale}-compare-base`} path={`/${locale}/compare`} component={ComparisonPage} />,
        <Route key={`${locale}-compare`} path={`/${locale}/compare/:ids`} component={ComparisonPage} />,
        <Route key={`${locale}-quiz`} path={`/${locale}/quiz`} component={QuizPage} />,
        <Route key={`${locale}-best`} path={`/${locale}/best/:category`} component={BestOfPage} />,
        <Route key={`${locale}-author`} path={`/${locale}/authors/:slug`} component={AuthorPage} />,
        <Route key={`${locale}-about`} path={`/${locale}/about`} component={AboutPage} />,
        <Route key={`${locale}-methodology`} path={`/${locale}/methodology`} component={MethodologyPage} />,
        <Route key={`${locale}-contact`} path={`/${locale}/contact`} component={ContactPage} />,
        <Route key={`${locale}-privacy`} path={`/${locale}/privacy`}>
          <LegalPage type="privacy" />
        </Route>,
        <Route key={`${locale}-terms`} path={`/${locale}/terms`}>
          <LegalPage type="terms" />
        </Route>,
        <Route key={`${locale}-disclosure`} path={`/${locale}/disclosure`}>
          <LegalPage type="disclosure" />
        </Route>
      ])}

      {/* Fallback for invalid routes */}
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CompareProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
            <CompareBar />
          </div>
          <Toaster />
        </CompareProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
