import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SectionCardsProps = {
  totalRevenueToday: number
  ordersToday: number
  activePrinters: number
  lowStockItems: number
  currencyCode?: string
}

function formatCurrency(value: number, currency = "USD") {
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  })
}

export function SectionCards({
  totalRevenueToday,
  ordersToday,
  activePrinters,
  lowStockItems,
  currencyCode = "USD",
}: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="@container/card rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardDescription>Today&apos;s Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(totalRevenueToday, currencyCode)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Sum of paid orders placed today
          </div>
          <div className="text-muted-foreground">
            Calculated from <code>/api/orders</code>
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardDescription>Today&apos;s Orders</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {ordersToday}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Orders created for your current store
          </div>
          <div className="text-muted-foreground">
            Based on the <code>placedAt</code> timestamp
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardDescription>Active Printers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activePrinters}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Devices checked-in in the last minute
          </div>
          <div className="text-muted-foreground">
            From <code>/api/print-devices/status</code>
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardDescription>Low-stock Items</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {lowStockItems}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {lowStockItems > 0 ? <IconTrendingDown /> : <IconTrendingUp />}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Inventory at or below reorder point
          </div>
          <div className="text-muted-foreground">
            From <code>/api/inventory</code>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
