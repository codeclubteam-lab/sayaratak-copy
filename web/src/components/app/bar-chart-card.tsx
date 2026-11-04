import { ChartCard, type ChartCardProps } from "./chart-card"

export const BarChartCard = (props: ChartCardProps) => (
  <ChartCard kind="bar" {...props} />
)
