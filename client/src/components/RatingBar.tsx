import { Progress } from "@/components/ui/progress";

interface RatingBarProps {
  label: string;
  value: number;
  abbreviation: string;
  showLabel?: boolean;
}

export function RatingBar({ label, value, abbreviation, showLabel = true }: RatingBarProps) {
  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-[28px]">
          {abbreviation}
        </span>
      )}
      <div className="flex-1 relative">
        <Progress value={value} className="h-2" data-testid={`rating-${abbreviation.toLowerCase()}`} />
      </div>
      <span className="text-sm font-medium min-w-[32px] text-right" data-testid={`value-${abbreviation.toLowerCase()}`}>
        {value}
      </span>
    </div>
  );
}

interface RatingMetricsProps {
  power: number;
  control: number;
  rebound: number;
  maneuverability: number;
  sweetSpot: number;
  compact?: boolean;
}

export function RatingMetrics({
  power,
  control,
  rebound,
  maneuverability,
  sweetSpot,
  compact = false,
}: RatingMetricsProps) {
  return (
    <div className={`space-y-${compact ? "2" : "3"}`}>
      <RatingBar label="Power" value={power} abbreviation="PWR" />
      <RatingBar label="Control" value={control} abbreviation="CTL" />
      <RatingBar label="Rebound" value={rebound} abbreviation="RBD" />
      <RatingBar label="Maneuverability" value={maneuverability} abbreviation="MAN" />
      <RatingBar label="Sweet Spot" value={sweetSpot} abbreviation="SS" />
    </div>
  );
}
