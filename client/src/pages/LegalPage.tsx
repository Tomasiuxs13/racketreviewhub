import { useI18n } from "@/i18n/useI18n";
import SEO from "@/components/SEO";

interface LegalPageProps {
    type: "privacy" | "terms" | "disclosure";
}

export default function LegalPage({ type }: LegalPageProps) {
    const { t } = useI18n();

    const seoData = {
        title: t(`legal.${type}.seoTitle`),
        url: `/${type}`,
        canonical: `/${type}`,
    };

    return (
        <>
            <SEO {...seoData} />
            <div className="min-h-screen bg-background pt-24 pb-16 sm:pt-32 sm:pb-24">
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                    <div className="mb-12">
                        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight mb-4 text-foreground">
                            {t(`legal.${type}.title`)}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(`legal.${type}.lastUpdated`)}
                        </p>
                    </div>

                    <div className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none">
                        {/* 
              This is a placeholder for actual legal text. 
              In a production system, this could load from a CMS or structured markdown.
            */}
                        {type === "privacy" && (
                            <>
                                <p>At Padel Racket Reviews, accessible from padelracketreviews.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Padel Racket Reviews and how we use it.</p>
                                <h2>Log Files</h2>
                                <p>Padel Racket Reviews follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services' analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks.</p>
                                <h2>Cookies and Web Beacons</h2>
                                <p>Like any other website, Padel Racket Reviews uses "cookies". These cookies are used to store information including visitors' preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.</p>
                            </>
                        )}

                        {type === "terms" && (
                            <>
                                <p>By accessing this website we assume you accept these terms and conditions. Do not continue to use Padel Racket Reviews if you do not agree to take all of the terms and conditions stated on this page.</p>
                                <h2>License</h2>
                                <p>Unless otherwise stated, Padel Racket Reviews and/or its licensors own the intellectual property rights for all material on Padel Racket Reviews. All intellectual property rights are reserved. You may access this from Padel Racket Reviews for your own personal use subjected to restrictions set in these terms and conditions.</p>
                                <h2>User Comments</h2>
                                <p>Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Padel Racket Reviews does not filter, edit, publish or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Padel Racket Reviews, its agents and/or affiliates.</p>
                            </>
                        )}

                        {type === "disclosure" && (
                            <>
                                <p>Padel Racket Reviews is a participant in various affiliate marketing programs. This means we may earn a commission on purchases made through our links to retailer sites.</p>
                                <h2>How it works</h2>
                                <p>When you click on links to various merchants on this site and make a purchase, this can result in this site earning a commission. Affiliate programs and affiliations include, but are not limited to, the Padel Nuestro Affiliate Program and Padel Market Affiliate Program.</p>
                                <h2>Editorial Independence</h2>
                                <p>The existence of affiliate links has no influence over the products we choose to review or the ratings we assign. Our reviews are entirely independent and based on our own rigorous testing protocols. We do not accept paid reviews from racket manufacturers.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
