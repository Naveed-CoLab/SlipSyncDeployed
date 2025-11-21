import { useMemo } from 'react'
import { BadgeCheckIcon, Building2 } from 'lucide-react'

import type { StoreSummary } from '@/types/store'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SidebarStoreSwitcherProps {
  stores: StoreSummary[]
  activeStoreId: string | null
  onSelect(storeId: string): void
  isLoading: boolean
}

export function SidebarStoreSwitcher({
  stores,
  activeStoreId,
  onSelect,
  isLoading,
}: SidebarStoreSwitcherProps) {
  const activeStore = useMemo(
    () => stores.find((store) => store.id === activeStoreId),
    [stores, activeStoreId],
  )

  return (
    <Select
      disabled={stores.length === 0 || isLoading}
      value={activeStoreId || ''}
      onValueChange={onSelect}
    >
      <SelectTrigger className="group h-16 w-full rounded-xl border border-border/60 bg-card/80 px-4 py-3 pr-8 text-left shadow-sm transition hover:border-border focus:border-primary">
        <div className="flex min-w-0 items-center gap-3">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold leading-tight">
              {activeStore?.name ?? 'Select store'}
            </span>
            <span
              className={cn(
                'line-clamp-2 text-[11px] leading-tight text-muted-foreground block',
                !activeStore && 'italic',
              )}
            >
              {activeStore?.address ?? 'Pick a store to view its data'}
            </span>
          </div>
        </div>
      </SelectTrigger>
      <SelectContent className="z-[80] w-[260px] rounded-xl border border-border bg-popover p-1 shadow-2xl">
        {stores.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No stores found.</div>
        ) : (
          stores.map((store) => (
            <SelectItem
              key={store.id}
              value={store.id}
              className="data-[state=checked]:bg-muted/70 flex flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition focus:bg-muted"
            >
              <div className="flex w-full flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{store.name}</span>
                  {store.isVerified !== false && (
                    <Badge variant="secondary" className="h-4 shrink-0 gap-1 px-2 text-[10px]">
                      <BadgeCheckIcon className="size-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                {store.address && (
                  <span className="text-xs text-muted-foreground">{store.address}</span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

