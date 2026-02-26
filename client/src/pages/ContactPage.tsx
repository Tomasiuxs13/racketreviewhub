import { useI18n } from "@/i18n/useI18n";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Clock, MessageSquare } from "lucide-react";

export default function ContactPage() {
    const { t } = useI18n();

    const seoData = {
        title: t("contact.seoTitle"),
        description: t("contact.seoDescription"),
        url: "/contact",
        canonical: "/contact",
    };

    return (
        <>
            <SEO {...seoData} />
            <div className="min-h-screen bg-background pt-24 pb-16 sm:pt-32 sm:pb-24">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl tracking-tight mb-6 text-foreground">
                            {t("contact.heroTitle")}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            {t("contact.heroSubtitle")}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="hover-elevate transition-all border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
                            <CardContent className="p-8 text-center sm:text-left flex flex-col items-center sm:items-start h-full">
                                <div className="p-4 bg-primary/10 rounded-full text-primary mb-6">
                                    <Mail className="h-8 w-8" />
                                </div>
                                <h2 className="font-heading font-bold text-2xl mb-4">
                                    {t("contact.emailUs")}
                                </h2>
                                <p className="text-muted-foreground mb-6 flex-grow">
                                    {t("contact.emailDescription")}
                                </p>
                                <a
                                    href={`mailto:${t("contact.emailAddress")}`}
                                    className="font-bold text-lg text-primary hover:text-primary/80 transition-colors"
                                >
                                    {t("contact.emailAddress")}
                                </a>
                            </CardContent>
                        </Card>

                        <div className="space-y-8">
                            <Card>
                                <CardContent className="p-6 flex items-start gap-4">
                                    <div className="p-3 bg-muted rounded-full">
                                        <Clock className="h-6 w-6 text-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg mb-2">Response Time</h3>
                                        <p className="text-muted-foreground">{t("contact.responseNote")}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6 flex items-start gap-4">
                                    <div className="p-3 bg-muted rounded-full">
                                        <MessageSquare className="h-6 w-6 text-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg mb-2">Feedback & Suggestions</h3>
                                        <p className="text-muted-foreground">We are always looking to improve our reviews and add more padel rackets. Reach out if you have a specific racket you want us to review!</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
