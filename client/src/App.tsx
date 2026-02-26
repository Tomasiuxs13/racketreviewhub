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
import BestOfPage from "@/pages/BestOfPage";
import AboutPage from "@/pages/AboutPage";
import MethodologyPage from "@/pages/MethodologyPage";
import ContactPage from "@/pages/ContactPage";
import LegalPage from "@/pages/LegalPage";
import NotFound from "@/pages/not-found";
import { AuthGuard } from "@/components/AuthGuard";
import { CompareBar } from "@/components/CompareBar";
import { SUPPORTED_LOCALES } from "@/i18n/I18nProvider";



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
