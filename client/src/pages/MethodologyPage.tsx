import { useI18n } from "@/i18n/useI18n";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck, Activity, LineChart, Target } from "lucide-react";

export default function MethodologyPage() {
    const { t } = useI18n();

    const seoData = {
        title: t("methodology.seoTitle"),
        description: t("methodology.seoDescription"),
        url: "/methodology",
        canonical: "/methodology",
    };

    return (
        <>
            <SEO {...seoData} />
            <div className="min-h-screen bg-background pt-24 pb-16 sm:pt-32 sm:pb-24">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl tracking-tight mb-6 text-foreground">
                            {t("methodology.heroTitle")}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            {t("methodology.heroSubtitle")}
                        </p>
                    </div>

                    {/* Testing Process */}
                    <section className="mb-20">
                        <h2 className="font-heading font-bold text-3xl mb-8 border-b pb-4">
                            {t("methodology.processTitle")}
                        </h2>
                        <div className="grid gap-6">
                            <Card className="hover-elevate transition-all">
                                <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                                        <ClipboardCheck className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{t("methodology.processSteps.step1Title")}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{t("methodology.processSteps.step1Body")}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="hover-elevate transition-all">
                                <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                                        <Activity className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{t("methodology.processSteps.step2Title")}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{t("methodology.processSteps.step2Body")}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="hover-elevate transition-all">
                                <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
                                        <LineChart className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{t("methodology.processSteps.step3Title")}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{t("methodology.processSteps.step3Body")}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="hover-elevate transition-all">
                                <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 shrink-0">
                                        <Target className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{t("methodology.processSteps.step4Title")}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{t("methodology.processSteps.step4Body")}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    {/* Metrics Explained */}
                    <section>
                        <h2 className="font-heading font-bold text-3xl mb-4">
                            {t("methodology.metricsTitle")}
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            {t("methodology.metricsIntro")}
                        </p>

                        <div className="bg-card p-8 rounded-2xl border premium-shadow space-y-6">
                            <div>
                                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    Power
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">{t("methodology.metricsDescriptions.power")}</p>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div>
                                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Control
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">{t("methodology.metricsDescriptions.control")}</p>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div>
                                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Rebound (Ball Output)
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">{t("methodology.metricsDescriptions.rebound")}</p>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div>
                                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    Maneuverability
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">{t("methodology.metricsDescriptions.maneuverability")}</p>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div>
                                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    Sweet Spot
                                </h4>
                                <p className="text-muted-foreground leading-relaxed">{t("methodology.metricsDescriptions.sweetSpot")}</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
