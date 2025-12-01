import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2, Store as StoreIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableSkeleton } from "@/components/ui/table-skeleton"

interface Employee {
  id: string
  clerkUserId: string
  email: string
  fullName: string
  roleId: string | null
  roleName: string | null
  storeAccess: string[]
  createdAt: string
}

interface Store {
  id: string
  name: string
  address?: string
  currency?: string
}

interface ManageEmployeesProps {
  apiBaseUrl: string
  token: string | null
  userRole?: string | null
  storeAccess?: string
}

export function ManageEmployees({ apiBaseUrl, token, userRole, storeAccess }: ManageEmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [selectedStores, setSelectedStores] = useState<Record<string, Set<string>>>({})

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    async function loadData() {
      try {
        setLoading(true)
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        }
        if (userRole) {
          headers['X-Clerk-Org-Role'] = userRole
        }
        if (storeAccess) {
          headers['X-Clerk-Store-Access'] = storeAccess
        }

        const [employeesRes, storesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/employees`, { headers }),
          fetch(`${apiBaseUrl}/api/employees/stores`, { headers }),
        ])

        if (!employeesRes.ok) {
          const errorText = await employeesRes.text()
          if (employeesRes.status === 403) {
            setError('Permission denied: Only administrators can manage employee store access.')
            setLoading(false)
            return
          }
          throw new Error(`Failed to load employees: ${employeesRes.status} - ${errorText}`)
        }
        if (!storesRes.ok) {
          const errorText = await storesRes.text()
          if (storesRes.status === 403) {
            setError('Permission denied: Only administrators can view all stores.')
            setLoading(false)
            return
          }
          throw new Error(`Failed to load stores: ${storesRes.status} - ${errorText}`)
        }

        const employeesData = (await employeesRes.json()) as Employee[]
        const storesData = (await storesRes.json()) as Store[]

        setEmployees(employeesData)
        setStores(storesData)

        // Initialize selected stores from employee's current access
        const initial: Record<string, Set<string>> = {}
        employeesData.forEach((emp) => {
          initial[emp.id] = new Set(emp.storeAccess)
        })
        setSelectedStores(initial)
        setError(null) // Clear any previous errors
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load employee data')
        toast.error('Failed to load employee data')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [apiBaseUrl, token, userRole, storeAccess])

  const handleStoreToggle = (employeeId: string, storeId: string) => {
    setSelectedStores((prev) => {
      const current = prev[employeeId] || new Set<string>()
      const updated = new Set(current)
      if (updated.has(storeId)) {
        updated.delete(storeId)
      } else {
        updated.add(storeId)
      }
      return { ...prev, [employeeId]: updated }
    })
  }

  const handleSave = async () => {
    if (!token || !editingEmployee) {
      return
    }

    const employeeId = editingEmployee.id

    try {
      setSaving((prev) => ({ ...prev, [employeeId]: true }))

      const storeIds = Array.from(selectedStores[employeeId] || [])
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      if (userRole) {
        headers['X-Clerk-Org-Role'] = userRole
      }
      if (storeAccess) {
        headers['X-Clerk-Store-Access'] = storeAccess
      }

      const res = await fetch(`${apiBaseUrl}/api/employees/${employeeId}/store-access`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ storeIds }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to update store access')
      }

      // Update local state
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId ? { ...emp, storeAccess: storeIds } : emp,
        ),
      )

      toast.success('Store access updated successfully')
      setIsDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to update store access')
    } finally {
      setSaving((prev) => ({ ...prev, [employeeId]: false }))
    }
  }

  const openManageDialog = (employee: Employee) => {
    setEditingEmployee(employee)
    setIsDialogOpen(true)
  }

  // Show error if backend returned 403 or any other error
  if (error) {
    const isPermissionError = error.includes('Permission denied') || error.includes('403')
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <EmptyState
              title={isPermissionError ? "Access Denied" : "Error"}
              description={error}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Manage Employees</CardTitle>
            <CardDescription className="text-sm">Loading employee data...</CardDescription>
          </CardHeader>
          <CardContent>
            <TableSkeleton columnCount={4} rowCount={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
      <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Manage Employees</CardTitle>
          <CardDescription className="text-sm">
            Assign store access to employees. Employees can only access stores you grant them.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {employees.length === 0 ? (
            <EmptyState
              title="No employees found"
              description="Employees will appear here once they are added to your organization in Clerk."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store Access</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const cleanName = (employee.fullName || employee.email || 'Unknown')
                    .replace(/Optional\[/gi, '')
                    .replace(/\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim() || employee.email

                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{cleanName}</span>
                          <span className="text-xs text-muted-foreground">{employee.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.roleName && (
                          <Badge
                            variant={employee.roleName === 'ADMIN' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {employee.roleName}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {employee.storeAccess.length} {employee.storeAccess.length === 1 ? 'store' : 'stores'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openManageDialog(employee)}
                        >
                          <StoreIcon className="mr-2 h-4 w-4" />
                          Manage Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Store Access</DialogTitle>
            <DialogDescription>
              Select the stores that <span className="font-medium text-foreground">{editingEmployee?.fullName || editingEmployee?.email}</span> can access.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No stores available. Create a store first.
              </p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                {editingEmployee && stores.map((store) => {
                  const isSelected = selectedStores[editingEmployee.id]?.has(store.id)
                  return (
                    <div
                      key={store.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:bg-muted/50'
                        }`}
                    >
                      <Checkbox
                        id={`dialog-${editingEmployee.id}-${store.id}`}
                        checked={isSelected}
                        onCheckedChange={() =>
                          handleStoreToggle(editingEmployee.id, store.id)
                        }
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`dialog-${editingEmployee.id}-${store.id}`}
                        className="flex-1 cursor-pointer text-sm leading-tight"
                      >
                        <div className="font-medium">{store.name}</div>
                        {store.address && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {store.address}
                          </div>
                        )}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editingEmployee || (saving[editingEmployee.id] ?? false)}
            >
              {(editingEmployee && saving[editingEmployee.id]) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}