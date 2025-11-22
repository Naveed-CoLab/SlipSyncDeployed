"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
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
import type { ChartConfig } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive revenue chart"

interface ChartAreaInteractiveProps {
  apiBaseUrl: string
  token: string | null
  storeId: string | null
  currency: string
  userRole?: string | null
  storeAccess?: string
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  },
  orders: {
    label: "Orders",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  apiBaseUrl,
  token,
  storeId,
  currency,
  userRole,
  storeAccess,
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [chartData, setChartData] = React.useState<Array<{ date: string; revenue: number; orders: number }>>([])
  const [loading, setLoading] = React.useState(true)

  const buildHeaders = () => {
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (userRole) {
      headers['X-Clerk-Org-Role'] = userRole
    }
    if (storeAccess) {
      headers['X-Clerk-Store-Access'] = storeAccess
    }
    return headers
  }

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    if (!token || !storeId) {
      setLoading(false)
      return
    }

    const fetchRevenueData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${apiBaseUrl}/api/orders`, {
          headers: buildHeaders(),
        })
        
        if (!response.ok) {
          if (response.status === 401) {
            toast.error('Authentication required. Please refresh the page.')
            return
          }
          const errorText = await response.text()
          throw new Error(errorText || 'Failed to fetch orders')
        }

        const orders = await response.json()
        
        // Group orders by date and calculate daily revenue and order count
        const dailyData = new Map<string, { revenue: number; orders: number }>()
        
        orders.forEach((order: any) => {
          if (!order.placedAt) return
          const date = new Date(order.placedAt).toISOString().split('T')[0]
          const revenue = parseFloat(order.totalAmount || order.subtotal || 0)
          
          if (!dailyData.has(date)) {
            dailyData.set(date, { revenue: 0, orders: 0 })
          }
          
          const dayData = dailyData.get(date)!
          dayData.revenue += revenue
          dayData.orders += 1
        })

        // Convert to array and sort by date
        const data = Array.from(dailyData.entries())
          .map(([date, values]) => ({
            date,
            revenue: Number(values.revenue.toFixed(2)),
            orders: values.orders,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))

        setChartData(data)
      } catch (error) {
        toast.error('Failed to load revenue data')
      } finally {
        setLoading(false)
      }
    }

    fetchRevenueData()
  }, [apiBaseUrl, token, storeId, userRole, storeAccess])

  const filteredData = React.useMemo(() => {
    if (!chartData.length) return []
    
    const now = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    startDate.setHours(0, 0, 0, 0)

    return chartData.filter((item) => {
      const date = new Date(item.date)
      return date >= startDate
    })
  }, [chartData, timeRange])

  // Fill in missing dates with zero values for smoother chart
  const filledData = React.useMemo(() => {
    if (!filteredData.length) return []
    
    const result: Array<{ date: string; revenue: number; orders: number }> = []
    const dataMap = new Map(filteredData.map(item => [item.date, item]))
    
    const startDate = new Date(filteredData[0].date)
    const endDate = new Date(filteredData[filteredData.length - 1].date)
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const existing = dataMap.get(dateStr)
      result.push(existing || { date: dateStr, revenue: 0, orders: 0 })
    }
    
    return result
  }, [filteredData])

  const totalRevenue = React.useMemo(() => {
    return filledData.reduce((sum, item) => sum + item.revenue, 0)
  }, [filledData])

  const totalOrders = React.useMemo(() => {
    return filledData.reduce((sum, item) => sum + item.orders, 0)
  }, [filledData])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Revenue and orders over time
          </span>
          <span className="@[540px]/card:hidden">Revenue over time</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[250px]">
            <div className="text-sm text-muted-foreground">Loading revenue data...</div>
          </div>
        ) : filledData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <div className="text-sm text-muted-foreground">No revenue data available</div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total Revenue</div>
                <div className="text-lg font-semibold">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 2,
                  }).format(totalRevenue)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Orders</div>
                <div className="text-lg font-semibold">{totalOrders}</div>
              </div>
            </div>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full max-w-full"
            >
              <AreaChart data={filledData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-orders)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-orders)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        return new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      }}
                      indicator="dot"
                      formatter={(value, name) => {
                        if (name === 'revenue') {
                          return [
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency,
                              maximumFractionDigits: 2,
                            }).format(Number(value)),
                            'Revenue'
                          ]
                        }
                        return [value, 'Orders']
                      }}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="natural"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="orders"
                  type="natural"
                  fill="url(#fillOrders)"
                  stroke="var(--color-orders)"
                  strokeWidth={1}
                  opacity={0.5}
                />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
