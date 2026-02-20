import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

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
    const data = useMemo(
        () => [
            { subject: "Power", A: power, fullMark: 100 },
            { subject: "Control", A: control, fullMark: 100 },
            { subject: "Rebound", A: rebound, fullMark: 100 },
            { subject: "Maneuverability", A: maneuverability, fullMark: 100 },
            { subject: "Sweet Spot", A: sweetSpot, fullMark: 100 },
        ],
        [power, control, rebound, maneuverability, sweetSpot]
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
