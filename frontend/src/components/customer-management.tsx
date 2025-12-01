import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  storeId: string
  storeName?: string
  createdAt: string
}

interface CustomerManagementProps {
  apiBaseUrl: string
  token: string | null
  storeId: string | null
  userRole?: string | null
  storeAccess?: string
}

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function CustomerManagement({
  apiBaseUrl,
  token,
  storeId,
  userRole,
  storeAccess,
}: CustomerManagementProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [authError, setAuthError] = useState(false)

  // Customer dialog state
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)

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

  const isAdmin = () => {
    if (!userRole) return false
    const role = userRole.toLowerCase()
    return role === 'org:admin' || role === 'admin'
  }

  const fetchCustomers = async () => {
    if (!token) {
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/customers`, {
        headers: buildHeaders(),
      })
      if (response.status === 401) {
        setAuthError(true)
        throw new Error('Authentication required. Please refresh the page or try again.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch customers')
      }
      const data = await response.json()
      setCustomers(data)
    } catch (error: any) {
      if (error.message.includes('Authentication')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to load customers')
      }
    }
  }

  const loadData = async () => {
    if (!token) {
      setLoading(false)
      setAuthError(true)
      return
    }

    setLoading(true)
    setAuthError(false)
    try {
      await fetchCustomers()
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, userRole, storeAccess])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!customerForm.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (customerForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email)) {
      newErrors.email = 'Invalid email address'
    }
    if (customerForm.phone && !/^\+?[\d\s-]+$/.test(customerForm.phone)) {
      newErrors.phone = 'Invalid phone number'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreateCustomer = async () => {
    if (!storeId) {
      toast.error('Please select a store first')
      return
    }
    if (!validateForm()) return

    try {
      const response = await fetch(`${apiBaseUrl}/api/customers`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: customerForm.name,
          email: customerForm.email || undefined,
          phone: customerForm.phone || undefined,
          storeId: storeId,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Customer created successfully')
      setCustomerDialogOpen(false)
      setCustomerForm({ name: '', email: '', phone: '' })
      setErrors({})
      await fetchCustomers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create customer')
    }
  }

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return
    if (!validateForm()) return

    try {
      const response = await fetch(`${apiBaseUrl}/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: customerForm.name,
          email: customerForm.email || undefined,
          phone: customerForm.phone || undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Customer updated successfully')
      setCustomerDialogOpen(false)
      setEditingCustomer(null)
      setCustomerForm({ name: '', email: '', phone: '' })
      setErrors({})
      await fetchCustomers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update customer')
    }
  }

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/customers/${customerToDelete.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })
      if (!response.ok) {
        const error = await response.text()
        if (response.status === 403) {
          toast.error(error, { duration: 5000 })
        } else {
          throw new Error(error)
        }
        return
      }
      toast.success('Customer deleted successfully')
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
      await fetchCustomers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  const openCustomerDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setCustomerForm({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
      })
    } else {
      setEditingCustomer(null)
      setCustomerForm({ name: '', email: '', phone: '' })
    }
    setErrors({})
    setCustomerDialogOpen(true)
  }

  if (loading && !authError) {
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Management
                </CardTitle>
                <CardDescription>
                  {isAdmin()
                    ? 'View and manage all customers across all stores'
                    : 'View and manage customers for your assigned stores'}
                </CardDescription>
              </div>
              {!isAdmin() && (
                <Badge variant="secondary" className="text-xs">
                  Limited Access
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <TableSkeleton columnCount={5} rowCount={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authError || !token) {
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Customer Management</CardTitle>
            <CardDescription>Authentication required</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              {!token
                ? 'Waiting for authentication token. This may be due to Supabase maintenance.'
                : 'Authentication failed. Please try again.'}
            </p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
      <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Management
              </CardTitle>
              <CardDescription>
                {isAdmin()
                  ? 'View and manage all customers across all stores'
                  : 'View and manage customers for your assigned stores'}
              </CardDescription>
            </div>
            {!isAdmin() && (
              <Badge variant="secondary" className="text-xs">
                Limited Access
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openCustomerDialog()} disabled={!storeId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
          {!storeId ? (
            <EmptyState
              title="No store selected"
              description="Please select a store to view and manage customers"
            />
          ) : customers.length === 0 ? (
            <EmptyState title="No customers" description="Create your first customer to get started" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-semibold">{customer.name}</TableCell>
                    <TableCell>{customer.email || '—'}</TableCell>
                    <TableCell>{customer.phone || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openCustomerDialog(customer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Create Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? 'Update customer information'
                : 'Add a new customer to your store'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={customerForm.name}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, name: e.target.value })
                  if (errors.name) setErrors({ ...errors, name: '' })
                }}
                placeholder="Customer name"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={customerForm.email}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, email: e.target.value })
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
                placeholder="customer@example.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={customerForm.phone}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, phone: e.target.value })
                  if (errors.phone) setErrors({ ...errors, phone: '' })
                }}
                placeholder="+1234567890"
                className={errors.phone ? 'border-destructive' : ''}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}>
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteCustomer}
        itemName={customerToDelete?.name}
        itemType="customer"
        isLoading={deleting}
      />
    </div>
  )
}

