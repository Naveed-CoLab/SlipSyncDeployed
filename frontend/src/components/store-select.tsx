import { Building2, Loader2 } from 'lucide-react'

import type { StoreSummary } from '@/types/store'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StoreSelectProps {
  stores: StoreSummary[]
  activeStoreId: string | null
  onSelect(storeId: string): void
  isLoading: boolean
}

export function StoreSelect({ stores, activeStoreId, onSelect, isLoading }: StoreSelectProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading stores…
      </div>
    )
  }

  const disabled = stores.length === 0

  return (
    <Select
      value={activeStoreId ?? undefined}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="w-[220px] justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <SelectValue
            placeholder={disabled ? 'No stores yet' : 'Select a store'}
            className="truncate"
          />
        </div>
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex flex-col">
              <span className="font-medium">{store.name}</span>
              {store.address && (
                <span className="text-xs text-muted-foreground">{store.address}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

