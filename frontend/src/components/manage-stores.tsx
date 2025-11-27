import { useEffect, useState } from 'react'
import { Trash2, Store } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'

interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  currency: string
  timezone: string | null
  createdAt: string
}

interface ManageStoresProps {
  apiBaseUrl: string
  token: string | null
  userRole?: string | null
  storeAccess?: string
  onStoreDeleted?(): void
}

export function ManageStores({
  apiBaseUrl,
  token,
  userRole,
  storeAccess,
  onStoreDeleted,
}: ManageStoresProps) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null)

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
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

  const fetchStores = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/stores`, {
        headers: buildHeaders(),
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied: Only admins can manage stores')
        }
        throw new Error('Failed to fetch stores')
      }
      const data = await response.json()
      setStores(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStores()
  }, [token, userRole, storeAccess])

  const handleDeleteStore = (id: string, name: string) => {
    setStoreToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const confirmDeleteStore = async () => {
    if (!storeToDelete) return

    setDeleting(storeToDelete.id)
    try {
      const response = await fetch(`${apiBaseUrl}/api/stores/${storeToDelete.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Store deleted successfully')
      setDeleteDialogOpen(false)
      setStoreToDelete(null)
      await fetchStores()
      if (onStoreDeleted) {
        onStoreDeleted()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete store')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Manage Stores</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
      <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Store className="h-5 w-5" />
            Manage Stores
          </CardTitle>
          <CardDescription>View and delete stores. Only administrators can access this page.</CardDescription>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <EmptyState title="No stores" description="Create a store to get started" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-semibold">{store.name}</TableCell>
                    <TableCell>{store.address || '—'}</TableCell>
                    <TableCell>{store.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{store.currency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStore(store.id, store.name)}
                        disabled={deleting === store.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteStore}
        itemName={storeToDelete?.name}
        itemType="store"
        description={
          storeToDelete
            ? `Are you sure you want to delete "${storeToDelete.name}"? This action cannot be undone and will delete all associated data (products, orders, inventory, etc.).`
            : undefined
        }
        isLoading={deleting === storeToDelete?.id}
      />
    </div>
  )
}

