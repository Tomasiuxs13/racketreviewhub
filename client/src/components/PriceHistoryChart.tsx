import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { PriceHistory } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceHistoryChartProps {
  racketId: string;
  currentPrice: string;
}

export function PriceHistoryChart({ racketId, currentPrice }: PriceHistoryChartProps) {
  const { data: history, isLoading } = useQuery<PriceHistory[]>({
    queryKey: [`/api/rackets/${racketId}/price-history`],
    enabled: !!racketId,
  });

  if (isLoading || !history || history.length < 2) {
    return null; // Don't show chart if fewer than 2 data points
  }

  // Group by date and take the lowest price per day (avoids mixing sources like CJ vs Padel Market)
  const priceByDate = new Map<string, { price: number; fullDate: string; date: string }>();
  for (const entry of history) {
    const d = new Date(entry.recordedAt);
    const dateKey = d.toISOString().slice(0, 10);
    const price = Number(entry.price);
    const existing = priceByDate.get(dateKey);
    if (!existing || price < existing.price) {
      priceByDate.set(dateKey, {
        date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        price,
        fullDate: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      });
    }
  }
  const chartData = Array.from(priceByDate.values());

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const currentPriceNum = Number(currentPrice);
  const firstPrice = prices[0];
  const priceDiff = currentPriceNum - firstPrice;
  const priceDiffPercent = firstPrice > 0 ? ((priceDiff / firstPrice) * 100).toFixed(1) : "0";

  // Determine trend
  const trend = priceDiff < -0.5 ? "down" : priceDiff > 0.5 ? "up" : "stable";

  // Y-axis padding
  const yMin = Math.floor(minPrice * 0.95);
  const yMax = Math.ceil(maxPrice * 1.05);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm sm:text-base">Price History</h3>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            {trend === "down" ? (
              <>
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">
                  {Math.abs(Number(priceDiffPercent))}% lower
                </span>
              </>
            ) : trend === "up" ? (
              <>
                <TrendingUp className="h-4 w-4 text-red-500" />
                <span className="text-red-500 font-medium">
                  {priceDiffPercent}% higher
                </span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Stable</span>
              </>
            )}
          </div>
        </div>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-md border bg-background p-2 shadow-sm">
                        <p className="text-xs text-muted-foreground">{data.fullDate}</p>
                        <p className="text-sm font-semibold">€{data.price.toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Low: €{minPrice.toFixed(2)}</span>
          <span>High: €{maxPrice.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
