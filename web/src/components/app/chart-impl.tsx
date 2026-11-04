import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import { useT } from "@/lib/i18n/use-t"
import { formatNumber, formatShortDate } from "@/lib/format"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ChartRow, ChartSeries } from "./chart-card"

// chart-2 is --signal, which only means "paid", so series skip it.
const colors = [1, 3, 4, 5] as const

// The only file besides ui/chart that imports Recharts, so ChartCard can load it lazily.
export function ChartImpl({
  kind,
  data,
  series,
  stacked,
}: {
  kind: "area" | "bar"
  data: ChartRow[]
  series: ChartSeries[]
  stacked?: boolean
}) {
  const { locale } = useT()
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: `var(--chart-${colors[i % colors.length]})` },
    ])
  )
  const Chart = kind === "area" ? AreaChart : BarChart
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <Chart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickFormatter={(v: string) => formatShortDate(v, locale)}
        />
        <YAxis
          // Fits the widest tick, so six-figure SDG amounts are not cut off.
          width="auto"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatNumber(v, locale)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => formatShortDate(String(v), locale)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) =>
          kind === "area" ? (
            <Area
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              fill={`var(--color-${s.key})`}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
          ) : (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              stackId={stacked ? "stack" : undefined}
              radius={stacked ? 0 : [2, 2, 0, 0]}
              isAnimationActive={false}
            />
          )
        )}
      </Chart>
    </ChartContainer>
  )
}
