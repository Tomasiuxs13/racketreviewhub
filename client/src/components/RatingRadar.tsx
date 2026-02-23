import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";

interface RatingRadarProps {
    power: number;
    control: number;
    rebound: number;
    maneuverability: number;
    sweetSpot: number;
}

export function RatingRadar({
    power,
    control,
    rebound,
    maneuverability,
    sweetSpot,
}: RatingRadarProps) {
    const { t } = useI18n();

    const data = useMemo(
        () => [
            { subject: t("racket.detail.radar.power") || "Power", A: power, fullMark: 100 },
            { subject: t("racket.detail.radar.control") || "Control", A: control, fullMark: 100 },
            { subject: t("racket.detail.radar.rebound") || "Rebound", A: rebound, fullMark: 100 },
            { subject: t("racket.detail.radar.maneuverability") || "Maneuverability", A: maneuverability, fullMark: 100 },
            { subject: t("racket.detail.radar.sweetSpot") || "Sweet Spot", A: sweetSpot, fullMark: 100 },
        ],
        [power, control, rebound, maneuverability, sweetSpot, t]
    );

    return (
        <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }}
                    />
                    <Radar
                        name="Racket Specs"
                        dataKey="A"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.4}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
