import { useI18n } from "@/i18n/useI18n";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { User, Award, Target, BookOpen } from "lucide-react";

export default function AboutPage() {
    const { t } = useI18n();

    const seoData = {
        title: t("about.seoTitle"),
        description: t("about.seoDescription"),
        url: "/about",
        canonical: "/about",
    };

    return (
        <>
            <SEO {...seoData} />
            <div className="min-h-screen bg-background pt-24 pb-16 sm:pt-32 sm:pb-24">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight mb-6 text-foreground">
                            {t("about.heroTitle")}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            {t("about.heroSubtitle")}
                        </p>
                    </div>

                    <div className="space-y-12">
                        {/* Story Section */}
                        <section className="prose prose-lg dark:prose-invert max-w-none">
                            <h2 className="font-heading font-bold text-3xl flex items-center gap-3">
                                <BookOpen className="text-primary h-8 w-8" />
                                {t("about.storyTitle")}
                            </h2>
                            <p>{t("about.storyBody1")}</p>
                            <p>{t("about.storyBody2")}</p>
                        </section>

                        {/* Expertise Section */}
                        <section className="prose prose-lg dark:prose-invert max-w-none">
                            <h2 className="font-heading font-bold text-3xl flex items-center gap-3">
                                <Award className="text-primary h-8 w-8" />
                                {t("about.teamTitle")}
                            </h2>
                            <p>{t("about.teamBody")}</p>
                        </section>

                        {/* Mission Section */}
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background premium-shadow relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
                            <CardContent className="p-8 sm:p-12 relative z-10 text-center">
                                <Target className="h-12 w-12 text-primary mx-auto mb-6" />
                                <h2 className="font-heading font-bold text-3xl mb-4">
                                    {t("about.missionTitle")}
                                </h2>
                                <p className="text-xl leading-relaxed">
                                    {t("about.missionBody")}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
