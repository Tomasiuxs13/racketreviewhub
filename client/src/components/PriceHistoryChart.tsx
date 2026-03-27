import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { PriceHistory } from "@shared/schema";
import {
  AreaChart,
  Area,
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
    return null;
  }

  const currentPriceNum = Number(currentPrice);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Build 6 month buckets
  const months: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  // Group history entries by month, take lowest price per month per day first
  const monthlyPrices = new Map<string, number[]>();
  for (const entry of history) {
    const d = new Date(entry.recordedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyPrices.has(key)) {
      monthlyPrices.set(key, []);
    }
    monthlyPrices.get(key)!.push(Number(entry.price));
  }

  // Build chart data — use lowest price in each month, fill gaps with previous month or current price
  const chartData: { month: string; price: number }[] = [];
  let lastKnownPrice = currentPriceNum;

  // Find the earliest known price to use as fallback for months before data
  const allPrices = history.map((e) => Number(e.price));
  const earliestPrice = allPrices[0] ?? currentPriceNum;
  lastKnownPrice = earliestPrice;

  for (const m of months) {
    const prices = monthlyPrices.get(m.key);
    if (prices && prices.length > 0) {
      lastKnownPrice = Math.min(...prices);
    }
    chartData.push({ month: m.label, price: lastKnownPrice });
  }

  // Ensure last month reflects the actual current price
  if (chartData.length > 0) {
    const lastMonth = months[months.length - 1];
    const isCurrentMonth =
      lastMonth.year === now.getFullYear() && lastMonth.month === now.getMonth();
    if (isCurrentMonth) {
      chartData[chartData.length - 1].price = Math.min(
        chartData[chartData.length - 1].price,
        currentPriceNum
      );
    }
  }

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = prices[0];
  const priceDiff = currentPriceNum - firstPrice;
  const priceDiffPercent = firstPrice > 0 ? ((priceDiff / firstPrice) * 100).toFixed(1) : "0";

  const trend = priceDiff < -0.5 ? "down" : priceDiff > 0.5 ? "up" : "stable";

  const yMin = Math.floor(minPrice * 0.92);
  const yMax = Math.ceil(maxPrice * 1.08);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-1">
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
        <p className="text-xs text-muted-foreground mb-4">Last 6 months · Best available price</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(value) => `€${value}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="text-xs font-medium text-muted-foreground">{data.month}</p>
                        <p className="text-base font-bold">€{data.price.toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#priceGradient)"
                dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "white" }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-3 px-1">
          <span>Low: <span className="font-semibold text-green-600">€{minPrice.toFixed(2)}</span></span>
          <span>Current: <span className="font-semibold text-foreground">€{currentPriceNum.toFixed(2)}</span></span>
          <span>High: <span className="font-semibold text-red-500">€{maxPrice.toFixed(2)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
