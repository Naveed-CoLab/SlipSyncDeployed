import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

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
          console.error('Failed to load employees:', employeesRes.status, errorText)
          if (employeesRes.status === 403) {
            setError('Permission denied: Only administrators can manage employee store access.')
            setLoading(false)
            return
          }
          throw new Error(`Failed to load employees: ${employeesRes.status} - ${errorText}`)
        }
        if (!storesRes.ok) {
          const errorText = await storesRes.text()
          console.error('Failed to load stores:', storesRes.status, errorText)
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
        console.error(error)
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

  const handleSave = async (employeeId: string) => {
    if (!token) {
      toast.error('Missing authentication token')
      return
    }

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
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to update store access')
    } finally {
      setSaving((prev) => ({ ...prev, [employeeId]: false }))
    }
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
          <CardContent className="pt-0">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
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
            <div className="space-y-4">
              {employees.map((employee) => {
                const employeeStores = selectedStores[employee.id] || new Set<string>()
                const hasChanges =
                  JSON.stringify(Array.from(employeeStores).sort()) !==
                  JSON.stringify(employee.storeAccess.sort())
                const isSaving = saving[employee.id] || false
                
                // Clean up fullName - remove "Optional" text and brackets
                const cleanName = (employee.fullName || employee.email || 'Unknown')
                  .replace(/Optional\[/gi, '')
                  .replace(/\]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim() || employee.email

                return (
                  <Card key={employee.id} className="border border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base font-semibold truncate">
                              {cleanName}
                            </CardTitle>
                            {employee.roleName && (
                              <Badge 
                                variant={employee.roleName === 'ADMIN' ? 'default' : 'secondary'}
                                className="text-xs shrink-0"
                              >
                                {employee.roleName}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            {employee.email}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {employee.storeAccess.length} {employee.storeAccess.length === 1 ? 'store' : 'stores'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Store Access
                          </p>
                          {stores.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">
                              No stores available. Create a store first.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {stores.map((store) => {
                                const isSelected = employeeStores.has(store.id)
                                return (
                                  <div
                                    key={store.id}
                                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                                      isSelected 
                                        ? 'border-primary bg-primary/5' 
                                        : 'border-border/60 hover:bg-muted/50'
                                    }`}
                                  >
                                    <Checkbox
                                      id={`${employee.id}-${store.id}`}
                                      checked={isSelected}
                                      onCheckedChange={() =>
                                        handleStoreToggle(employee.id, store.id)
                                      }
                                      className="mt-0.5"
                                    />
                                    <label
                                      htmlFor={`${employee.id}-${store.id}`}
                                      className="flex-1 cursor-pointer text-xs leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      <div className="font-medium text-sm mb-0.5">{store.name}</div>
                                      {store.address && (
                                        <div className="text-xs text-muted-foreground line-clamp-1">
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
                        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                          {hasChanges && (
                            <Badge variant="outline" className="mr-auto text-xs">
                              Unsaved changes
                            </Badge>
                          )}
                          <Button
                            onClick={() => handleSave(employee.id)}
                            disabled={!hasChanges || isSaving}
                            size="sm"
                            className="h-8 text-xs"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="mr-1.5 size-3 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-1.5 size-3" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

