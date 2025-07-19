import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton";
import { ChartDataPoint } from "@/hooks/useRevenueChartData";

interface RevenueChartProps {
  data: ChartDataPoint[];
  loading: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (data.length === 0 && !loading) {
    return (
       <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Your placement revenue will be shown here once you log placements with a fee and start date.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">No placement data to display.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Overview</CardTitle>
        <CardDescription>Your placement revenue from successful contracts.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value as number)} />}
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}