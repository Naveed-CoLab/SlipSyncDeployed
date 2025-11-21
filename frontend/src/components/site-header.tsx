import { Building2, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface SiteHeaderProps {
  merchantName?: string | null
  storeName?: string | null
  storeAddress?: string | null
}

export function SiteHeader({
  merchantName = 'SlipSync',
  storeName,
  storeAddress,
}: SiteHeaderProps) {
  return (
    <header className="flex flex-col gap-3 bg-background/95 px-4 py-4 text-foreground transition-[width,height] ease-linear lg:px-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">SlipSync dashboard</p>
          <h1 className="text-lg font-semibold">Overview</h1>
        </div>
        <SidebarTrigger className="-mr-1 lg:hidden" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
          {merchantName}
        </Badge>
        {storeName && (
          <div className="flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{storeName}</span>
            {storeAddress && (
              <span className={cn('flex items-center gap-1 text-muted-foreground')}>
                <MapPin className="size-3" />
                {storeAddress}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
