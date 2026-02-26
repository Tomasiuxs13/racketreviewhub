import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Racket } from "@shared/schema";
import { RacketCard } from "@/components/RacketCard";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
export default function BestOfPage() {
    const { category } = useParams<{ category: string }>();
    const t = (key: string, def?: string) => def || key;
    const i18n = { language: "en" };

    // Validate and parse category
    const validCategories: Record<string, { title: string; description: string }> = {
        "power": { title: "Best Power Padel Rackets", description: "Dominate the court with maximum explosive power and aggressive smash capabilities." },
        "control": { title: "Best Control Padel Rackets", description: "Pinpoint accuracy and defensive stability for the tactical, precise player." },
        "beginner": { title: "Best Beginner Padel Rackets", description: "Forgiving, easy-to-play rackets with large sweet spots, perfect for starting out." },
        "advanced": { title: "Best Advanced Padel Rackets", description: "Premium technological marvels built for competition-level performance." },
        "budget": { title: "Best Budget Padel Rackets", description: "Incredible value for money without sacrificing build quality or playability." },
        "overall": { title: "Best Overall Padel Rackets", description: "Our top-rated rackets combining power, control, maneuverability, and value." }
    };

    const categoryName = category?.toLowerCase() || "overall";
    const categoryData = validCategories[categoryName] || validCategories["overall"];

    const { data: rackets, isLoading } = useQuery<Racket[]>({
        queryKey: [`/api/rackets/best/${categoryName}`],
    });

    const year = new Date().getFullYear();
    const pageTitle = `${categoryData.title} of ${year} - Expert Reviews`;
    const pageDescription = `Discover the ${categoryData.title.toLowerCase()} for ${year}. ${categoryData.description} Read our comprehensive, hands-on expert reviews and comparisons.`;

    return (
        <div className="min-h-screen bg-background pb-20">
            <SEO
                title={pageTitle}
                description={pageDescription}
                image="/social-card.jpg"
            />

            {/* Premium Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden bg-muted/30 border-b border-border/40">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"></div>
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-background to-transparent pointer-events-none"></div>
                    <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-black/10"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <Breadcrumbs
                        items={[
                            { label: t("nav.rackets", "Rackets"), href: "/rackets" },
                            { label: "Best Of" }
                        ]}
                    />

                    <div className="mt-8 flex items-center justify-between flex-wrap gap-8">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary mb-6">
                                <Trophy className="h-4 w-4" />
                                <span className="text-sm font-medium uppercase tracking-wider">Top Rated {year}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight tracking-tight mb-6">
                                {categoryData.title}
                            </h1>
                            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                                {categoryData.description} Analyzed and selected by our experts.
                            </p>
                        </div>

                        <div className="hidden lg:flex items-center justify-center relative w-72 h-72">
                            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[spin_10s_linear_infinite]"></div>
                            <div className="absolute inset-4 rounded-full border-2 border-primary/10 animate-[spin_15s_linear_infinite_reverse]"></div>
                            <Trophy className="h-24 w-24 text-primary opacity-60 drop-shadow-2xl" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center min-h-[40vh] gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse font-medium">Analyzing test data...</p>
                    </div>
                ) : !rackets || rackets.length === 0 ? (
                    <div className="text-center py-24 bg-card rounded-2xl border border-border/50 shadow-sm">
                        <h3 className="text-xl font-bold mb-3">{t("errors.noData", "No rackets found")}</h3>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">We couldn't find any rackets matching this category. Check back soon as we continuously review new equipment.</p>
                        <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {t("common.backToHome", "Back to Home")}
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-12">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold font-heading">
                                Top {rackets.length} Selections
                            </h2>
                            <p className="text-sm text-muted-foreground">Updated {new Date().toLocaleDateString(i18n.language === "en" ? 'en-US' : i18n.language, { month: 'long', year: 'numeric' })}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                            {rackets.map((racket, i) => (
                                <div key={racket.id} className="relative">
                                    {/* Ranking Number */}
                                    <div className="absolute -top-4 -left-4 z-20 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center font-heading font-black text-xl shadow-lg border-2 border-background transform hover:scale-110 transition-transform">
                                        {i + 1}
                                    </div>
                                    <RacketCard racket={racket} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
