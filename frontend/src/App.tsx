import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrganization, useOrganizationList, useSession } from '@clerk/clerk-react'
import { Toaster, toast } from 'sonner'
import { Download, BadgeCheck } from 'lucide-react'

import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { EmptyState } from '@/components/empty-state'
import { OrderProcessing } from '@/components/order-processing'
import { ManageEmployees } from '@/components/manage-employees'
import { ProductManagement } from '@/components/product-management'
import { ManageStores } from '@/components/manage-stores'
import { CustomerManagement } from '@/components/customer-management'
import { OrderReceipt } from '@/components/order-receipt'
import { SectionCards } from '@/components/section-cards'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Layout } from '@/Layout'
import { Skeleton } from '@/components/ui/skeleton'
import type { StoreSummary } from '@/types/store'
import type {
  DeviceStatus,
  InvoiceSummary,
  OrderSummary,
  ProductInventoryEntry,
} from '@/types/dashboard'
import type { SalesSummary } from '@/types/reports'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function normalizeAmount(value: number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatCurrencyValue(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  }
}

function App() {
  const { session } = useSession()
  const { organization } = useOrganization()
  const { isLoaded: orgsLoaded, userMemberships } = useOrganizationList()
  const [apiToken, setApiToken] = useState<string | null>(null)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesVersion, setStoresVersion] = useState(0)
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('store') ?? localStorage.getItem('slipsync.activeStoreId')
  })
  const [currentRoute, setCurrentRoute] = useState<string>(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname || '/',
  )
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [productsOverview, setProductsOverview] = useState<ProductInventoryEntry[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [dbUserRole, setDbUserRole] = useState<string | null>(null) // Role from database
  const [reports, setReports] = useState<{ daily: SalesSummary | null; monthly: SalesSummary | null }>({
    daily: null,
    monthly: null,
  })
  const [fetchingReports, setFetchingReports] = useState(false)
  const [reportVersion, setReportVersion] = useState(0)
  const activeStore = useMemo(
    () => stores.find((store) => store.id === activeStoreId) ?? null,
    [stores, activeStoreId],
  )
  const persistStoreSelection = useCallback((storeId: string | null) => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    if (storeId) {
      window.localStorage.setItem('slipsync.activeStoreId', storeId)
      params.set('store', storeId)
    } else {
      window.localStorage.removeItem('slipsync.activeStoreId')
      params.delete('store')
    }

    const query = params.toString()
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [])

  const handleSelectStore = useCallback(
    (storeId: string) => {
      setActiveStoreId(storeId)
      persistStoreSelection(storeId)
    },
    [persistStoreSelection],
  )

  // Get current user's role and store_access from organization membership
  const currentMembership = useMemo(() => {
    if (!organization || !userMemberships) return null
    const memberships = userMemberships as any
    const data = memberships?.data || []
    return data.find((m: any) => m.organization.id === organization.id) || data[0] || null
  }, [organization, userMemberships])

  // Use role from database (preferred) or fallback to Clerk organization role
  const userRole = useMemo(() => {
    // Prefer database role, fallback to Clerk organization membership role (via currentMembership)
    const role = dbUserRole || currentMembership?.role || null
    return role
  }, [dbUserRole, currentMembership?.role])

  const storeAccess = useMemo(() => {
    // Get store_access from organization metadata (publicMetadata)
    const metadata = organization?.publicMetadata || {}
    const access = (metadata as any)?.store_access
    if (Array.isArray(access)) {
      return access.join(',')
    }
    if (typeof access === 'string') {
      return access
    }
    return ''
  }, [organization])

  // Helper to build headers with role and store_access
  const buildHeaders = useCallback((includeContentType = false): Record<string, string> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken || ''}`,
    }
    if (activeStoreId) {
      headers['X-Store-Id'] = activeStoreId
    }
    if (includeContentType) {
      headers['Content-Type'] = 'application/json'
    }
    if (userRole) {
      headers['X-Clerk-Org-Role'] = userRole
    }
    if (storeAccess) {
      headers['X-Clerk-Store-Access'] = storeAccess
    }
    return headers
  }, [apiToken, activeStoreId, userRole, storeAccess])

  useEffect(() => {
    // Wait until both the Clerk session and organization list are loaded.
    if (!session || !orgsLoaded) return

    let canceled = false

    async function syncAndSetToken() {
      try {
        const token = await session!.getToken()
        if (!token || canceled) return

        // Store token for API calls
        setApiToken(token)

        // Prefer active organization; fall back to first membership if needed
        const memberships = userMemberships as any
        const fallbackOrgId =
          memberships && memberships.data && memberships.data.length > 0
            ? memberships.data[0].organization.id
            : ''

        const orgId = organization?.id || fallbackOrgId

        // Build headers with role and store_access
        const headers: HeadersInit = {
          Authorization: `Bearer ${token}`,
          'X-Clerk-Org-Id': orgId,
        }

        if (userRole) {
          headers['X-Clerk-Org-Role'] = userRole
        }

        if (storeAccess) {
          headers['X-Clerk-Store-Access'] = storeAccess
        }

        // Call backend sync so it can create Merchant + Store + User if needed
        const syncRes = await fetch(`${API_BASE_URL}/api/auth/sync`, {
          method: 'POST',
          headers,
        })

        if (syncRes.ok) {
          const syncData = await syncRes.json()
          // Store role from sync response
          if (syncData.roleName) {
            setDbUserRole(syncData.roleName)
          }
        }

        // Also fetch role from /api/auth/me endpoint (more reliable)
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (meRes.ok) {
            const meData = await meRes.json()
            if (meData.roleName) {
              setDbUserRole(meData.roleName)
            }
          }
        } catch (meErr) {
          // Silently fail - role will fallback to Clerk role
        }
      } catch (err) {
        // Silently fail - user can still use the app
      }
    }

    void syncAndSetToken()

    return () => {
      canceled = true
    }
  }, [session, orgsLoaded, organization?.id, userMemberships, userRole, storeAccess])

  useEffect(() => {
    function handleStoreCreated() {
      setStoresVersion((prev) => prev + 1)
    }

    window.addEventListener('slipsync:store-created', handleStoreCreated)
    return () => window.removeEventListener('slipsync:store-created', handleStoreCreated)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!apiToken) {
      setStores([])
      setStoresLoading(false)
      setActiveStoreId(null)
      setOrders([])
      setProductsOverview([])
      setInvoices([])
      return
    }

    let canceled = false

    async function fetchStores() {
      try {
        setStoresLoading(true)

        // Build headers with role and store_access
        const headers: HeadersInit = {
          Authorization: `Bearer ${apiToken}`,
        }

        if (userRole) {
          headers['X-Clerk-Org-Role'] = userRole
        }

        if (storeAccess) {
          headers['X-Clerk-Store-Access'] = storeAccess
        }

        const res = await fetch(`${API_BASE_URL}/api/stores`, {
          headers,
        })

        if (!res.ok) {
          throw new Error(`Stores request failed: ${res.status}`)
        }

        const data = (await res.json()) as StoreSummary[]
        if (canceled) return

        setStores(data)

        if (!data.length) {
          setActiveStoreId(null)
          persistStoreSelection(null)
          return
        }

        if (!activeStoreId || !data.some((store) => store.id === activeStoreId)) {
          const nextStoreId = data[0].id
          setActiveStoreId(nextStoreId)
          persistStoreSelection(nextStoreId)
        }
      } catch (err) {
        toast.error('Failed to load stores')
      } finally {
        if (!canceled) {
          setStoresLoading(false)
        }
      }
    }

    void fetchStores()
    return () => {
      canceled = true
    }
  }, [apiToken, storesVersion, activeStoreId, persistStoreSelection, userRole, storeAccess])

  useEffect(() => {
    if (!apiToken || !activeStoreId) {
      setLoading(false)
      setOrders([])
      setProductsOverview([])
      setInvoices([])
      setDeviceStatus(null)
      return
    }

    // Build headers with role, store_access, and active store
    const headers: HeadersInit = {
      Authorization: `Bearer ${apiToken}`,
      'X-Store-Id': activeStoreId,
    }

    if (userRole) {
      headers['X-Clerk-Org-Role'] = userRole
    }

    if (storeAccess) {
      headers['X-Clerk-Store-Access'] = storeAccess
    }

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [ordersRes, productsRes, invoicesRes, devicesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/orders`, { headers }),
          fetch(`${API_BASE_URL}/api/products/overview`, { headers }),
          fetch(`${API_BASE_URL}/api/invoices`, { headers }),
          fetch(`${API_BASE_URL}/api/print-devices/status`, { headers }),
        ])

        if (!ordersRes.ok) {
          throw new Error(`Orders request failed: ${ordersRes.status}`)
        }
        if (!productsRes.ok) {
          throw new Error(`Products request failed: ${productsRes.status}`)
        }
        if (!invoicesRes.ok) {
          throw new Error(`Invoices request failed: ${invoicesRes.status}`)
        }
        if (!devicesRes.ok) {
          throw new Error(`Devices request failed: ${devicesRes.status}`)
        }

        const ordersJson = (await ordersRes.json()) as OrderSummary[]
        const productsJson = (await productsRes.json()) as ProductInventoryEntry[]
        const invoicesJson = (await invoicesRes.json()) as InvoiceSummary[]
        const devicesJson = (await devicesRes.json()) as DeviceStatus

        setOrders(ordersJson)
        setProductsOverview(productsJson)
        setInvoices(invoicesJson)
        setDeviceStatus(devicesJson)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [apiToken, activeStoreId, dataVersion, userRole, storeAccess])

  // Fetch reports data
  useEffect(() => {
    if (!apiToken || !activeStoreId) {
      return
    }
    let cancelled = false
    async function fetchReports() {
      try {
        setFetchingReports(true)
        const headers = buildHeaders()
        const [dailyRes, monthlyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reports/sales/summary?range=daily`, { headers }),
          fetch(`${API_BASE_URL}/api/reports/sales/summary?range=monthly`, { headers }),
        ])
        if (!dailyRes.ok || !monthlyRes.ok) {
          throw new Error('Failed to load reports')
        }
        const dailyJson = (await dailyRes.json()) as SalesSummary
        const monthlyJson = (await monthlyRes.json()) as SalesSummary
        if (!cancelled) {
          setReports({ daily: dailyJson, monthly: monthlyJson })
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('Unable to load reporting data')
        }
      } finally {
        if (!cancelled) {
          setFetchingReports(false)
        }
      }
    }
    void fetchReports()
    return () => {
      cancelled = true
    }
  }, [apiToken, activeStoreId, reportVersion, buildHeaders])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const todaysOrders = useMemo(
    () =>
      orders.filter((order) =>
        order.placedAt ? order.placedAt.slice(0, 10) === today : false,
      ),
    [orders, today],
  )

  const totalRevenueToday = useMemo(
    () =>
      todaysOrders.reduce(
        (sum, order) => sum + normalizeAmount(order.totalAmount),
        0,
      ),
    [todaysOrders],
  )

  const lowStockItems = useMemo(
    () =>
      productsOverview.filter((item) => {
        if (item.reorderPoint == null) return false
        return item.quantity <= item.reorderPoint
      }).length,
    [productsOverview],
  )

  const normalizedRoute =
    !currentRoute || currentRoute === '/' ? '/' : currentRoute.replace(/\/+$/, '') || '/'
  const isDashboard = normalizedRoute === '/'

  const merchantName = organization?.name ?? 'SlipSync Merchant'
  const storeAddress = activeStore?.address ?? null
  const storeCurrency = activeStore?.currency ?? 'USD'
  const totalSkus = productsOverview.length
  const hasOrders = orders.length > 0
  const isLoadingDashboard = loading && !error
  const refreshStoreData = useCallback(() => {
    setDataVersion((prev) => prev + 1)
  }, [])

  const refreshReports = useCallback(() => {
    if (!apiToken || !activeStoreId) return
    setReports({ daily: null, monthly: null })
    setReportVersion((prev) => prev + 1)
  }, [apiToken, activeStoreId])

  const handleExportCsv = useCallback(async (range: 'daily' | 'monthly') => {
    if (!apiToken || !activeStoreId) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/sales/export?range=${range}`, {
        headers: buildHeaders(),
      })
      if (!res.ok) throw new Error('Failed to export CSV')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-${range}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Unable to download CSV')
    }
  }, [apiToken, activeStoreId, buildHeaders])

  const layoutSidebarProps = {
    stores,
    activeStoreId,
    onSelectStore: handleSelectStore,
    storesLoading,
    userRole,
  }

  let pageContent: React.ReactNode

  if (isDashboard) {
    pageContent = (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6 overflow-x-hidden">
        <div className="flex flex-col gap-6 w-full max-w-full">
          {isLoadingDashboard ? (
            <SectionCardsSkeleton />
          ) : (
            <SectionCards
              totalRevenueToday={totalRevenueToday}
              ordersToday={todaysOrders.length}
              activePrinters={deviceStatus?.activeDevices ?? 0}
              lowStockItems={lowStockItems}
              currencyCode={storeCurrency}
            />
          )}

          {/* Sales Snapshots Card */}
          <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="size-4" />
                Sales snapshots
              </CardTitle>
              <p className="text-sm text-muted-foreground">Daily and monthly performance for this store.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['daily', 'monthly'] as const).map((range) => {
                const summary = reports[range]
                return (
                  <div
                    key={range}
                    className="rounded-2xl border border-border/60 bg-background/50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{range}</p>
                        <p className="text-2xl font-semibold">
                          {summary ? formatCurrencyValue(Number(summary.netSales ?? 0), storeCurrency) : '—'}
                        </p>
                      </div>
                      <Badge variant="secondary">{summary?.orderCount ?? 0} orders</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Gross</p>
                        <p className="font-medium">
                          {summary ? formatCurrencyValue(Number(summary.grossSales ?? 0), storeCurrency) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Discounts</p>
                        <p className="font-medium">
                          {summary ? formatCurrencyValue(Number(summary.discountsTotal ?? 0), storeCurrency) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taxes</p>
                        <p className="font-medium">
                          {summary ? formatCurrencyValue(Number(summary.taxesTotal ?? 0), storeCurrency) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportCsv(range)}
                        disabled={fetchingReports}
                      >
                        <Download className="mr-2 size-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Revenue trend
              </CardTitle>
              {activeStore?.name && (
                <p className="text-sm text-muted-foreground">
                  Showing performance for {activeStore.name}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingDashboard ? (
                <ChartSkeleton />
              ) : (
                <ChartAreaInteractive
                  apiBaseUrl={API_BASE_URL}
                  token={apiToken}
                  storeId={activeStoreId}
                  currency={storeCurrency}
                  userRole={userRole}
                  storeAccess={storeAccess}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Orders overview</CardTitle>
                  {activeStore?.name && (
                    <p className="text-sm text-muted-foreground">
                      Showing data for {activeStore.name}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? (
                  <TableSkeleton rows={5} />
                ) : hasOrders ? (
                  <OrdersTable orders={orders} currency={storeCurrency} limit={8} />
                ) : (
                  <EmptyState
                    title="No orders yet"
                    description="Switch stores or create an order to see activity here."
                  />
                )}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Store insights</CardTitle>
                {activeStore?.name && (
                  <p className="text-sm text-muted-foreground">{activeStore.name}</p>
                )}
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? (
                  <StoreInsightsSkeleton />
                ) : activeStore ? (
                  <dl className="grid gap-4 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div className="text-muted-foreground">Currency</div>
                      <div className="font-semibold text-foreground">{storeCurrency}</div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div className="text-muted-foreground">Total products</div>
                      <div className="font-semibold text-foreground">{totalSkus}</div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div className="text-muted-foreground">Low stock</div>
                      <div className="font-semibold text-foreground">{lowStockItems}</div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div className="text-muted-foreground">Active printers</div>
                      <div className="font-semibold text-foreground">
                        {deviceStatus?.activeDevices ?? 0}
                      </div>
                    </div>
                  </dl>
                ) : (
                  <EmptyState
                    title="No store selected"
                    description="Choose a store from the sidebar to see merchant insights."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Products</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Inventory health for {activeStore?.name ?? 'your store'}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? (
                  <TableSkeleton rows={4} />
                ) : productsOverview.length ? (
                  <ProductsTable items={productsOverview} currency={storeCurrency} limit={6} />
                ) : (
                  <EmptyState
                    title="No products found"
                    description="Create a product in Quick Create to see it appear here."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Recent invoices</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Synced with orders for {activeStore?.name ?? 'this store'}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDashboard ? (
                  <TableSkeleton rows={4} />
                ) : invoices.length ? (
                  <InvoicesTable invoices={invoices} limit={6} />
                ) : (
                  <EmptyState
                    title="No invoices yet"
                    description="Generate invoices by creating orders."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  } else if (normalizedRoute === '/products') {
    pageContent = (
      <ProductManagement
        apiBaseUrl={API_BASE_URL}
        token={apiToken}
        storeId={activeStoreId}
        currency={storeCurrency}
        userRole={userRole}
        storeAccess={storeAccess}
      />
    )
  } else if (normalizedRoute === '/orders') {
    pageContent = (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-xl font-semibold">Orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Recent orders for {activeStore?.name ?? 'your store'}.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <TableSkeleton rows={8} />
            ) : hasOrders ? (
              <OrdersTable
                orders={orders}
                currency={storeCurrency}
                onOrderClick={(orderId) => setSelectedOrderId(orderId)}
              />
            ) : (
              <EmptyState
                title="No orders yet"
                description="Switch stores or create an order to see activity here."
              />
            )}
          </CardContent>
        </Card>
        <OrderReceipt
          apiBaseUrl={API_BASE_URL}
          token={apiToken}
          orderId={selectedOrderId}
          currency={storeCurrency}
          open={selectedOrderId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedOrderId(null)
          }}
          userRole={userRole}
          storeAccess={storeAccess}
        />
      </div>
    )
  } else if (normalizedRoute === '/invoices') {
    pageContent = (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="text-xl font-semibold">Invoices</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest invoices linked to your store&apos;s orders.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <TableSkeleton rows={6} />
            ) : invoices.length ? (
              <InvoicesTable invoices={invoices} />
            ) : (
              <EmptyState
                title="No invoices yet"
                description="Generate invoices by creating orders."
              />
            )}
          </CardContent>
        </Card>
      </div>
    )
  } else if (normalizedRoute === '/pos') {
    pageContent = (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <OrderProcessing
          apiBaseUrl={API_BASE_URL}
          token={apiToken}
          merchantName={merchantName}
          storeId={activeStoreId}
          storeName={activeStore?.name}
          products={productsOverview}
          currency={storeCurrency}
          userRole={userRole}
          storeAccess={storeAccess}
          onRefresh={refreshStoreData}
          refreshReports={refreshReports}
        />
      </div>
    )
  } else if (normalizedRoute === '/manage-employees') {
    pageContent = (
      <ManageEmployees
        apiBaseUrl={API_BASE_URL}
        token={apiToken}
        userRole={userRole}
        storeAccess={storeAccess}
      />
    )
  } else if (normalizedRoute === '/manage-stores') {
    pageContent = (
      <ManageStores
        apiBaseUrl={API_BASE_URL}
        token={apiToken}
        userRole={userRole}
        storeAccess={storeAccess}
        onStoreDeleted={() => {
          setStoresVersion((v) => v + 1)
          refreshStoreData()
        }}
      />
    )
  } else if (normalizedRoute === '/customers') {
    pageContent = (
      <CustomerManagement
        apiBaseUrl={API_BASE_URL}
        token={apiToken}
        storeId={activeStoreId}
        userRole={userRole}
        storeAccess={storeAccess}
      />
    )
  } else {
    pageContent = (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <EmptyState
          title="Page not found"
          description="The page you requested does not exist. Use the sidebar to navigate."
        />
      </div>
    )
  }

  return (
    <>
      <Layout sidebarProps={layoutSidebarProps}>
        <SiteHeader
          merchantName={merchantName}
          storeName={activeStore?.name ?? null}
          storeAddress={storeAddress}
        />

        {error && (
          <div className="px-4 py-2 text-sm text-red-500 lg:px-6">Backend error: {error}</div>
        )}

        {pageContent}
      </Layout>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App

function SectionCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur"
        >
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-2xl" />
}

function StoreInsightsSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Skeleton key={idx} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value ?? '—'
  }
}

function OrdersTable({
  orders,
  currency,
  limit,
  onOrderClick,
}: {
  orders: OrderSummary[]
  currency: string
  limit?: number
  onOrderClick?: (orderId: string) => void
}) {
  const rows = typeof limit === 'number' ? orders.slice(0, limit) : orders
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((order) => (
            <TableRow
              key={order.id}
              className={onOrderClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              onClick={() => onOrderClick?.(order.id)}
            >
              <TableCell>
                <div className="font-semibold">{order.orderNumber}</div>
                <div className="text-xs text-muted-foreground">{order.customerName}</div>
              </TableCell>
              <TableCell>{order.itemCount}</TableCell>
              <TableCell className="font-semibold">
                {formatCurrencyValue(
                  normalizeAmount(order.totalAmount),
                  order.currency || currency,
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(order.placedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProductsTable({
  items,
  currency,
  limit,
}: {
  items: ProductInventoryEntry[]
  currency: string
  limit?: number
}) {
  const rows = typeof limit === 'number' ? items.slice(0, limit) : items
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => {
            const lowStock =
              entry.reorderPoint != null && entry.reorderPoint > 0 && entry.quantity <= entry.reorderPoint
            return (
              <TableRow key={entry.inventoryId ?? entry.variantId}>
                <TableCell>
                  <div className="font-semibold">{entry.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    Added {formatDate(entry.createdAt)}
                  </div>
                </TableCell>
                <TableCell>{entry.sku || '—'}</TableCell>
                <TableCell className="font-semibold">
                  {formatCurrencyValue(normalizeAmount(entry.price), currency)}
                </TableCell>
                <TableCell>{entry.quantity}</TableCell>
                <TableCell>
                  <Badge variant={lowStock ? 'destructive' : 'secondary'}>
                    {lowStock ? 'Low stock' : 'In stock'}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function InvoicesTable({ invoices, limit }: { invoices: InvoiceSummary[]; limit?: number }) {
  const rows = typeof limit === 'number' ? invoices.slice(0, limit) : invoices
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Issued</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <div className="font-semibold">{invoice.invoiceNumber}</div>
              </TableCell>
              <TableCell>{invoice.orderNumber ?? '—'}</TableCell>
              <TableCell className="font-semibold">
                {formatCurrencyValue(normalizeAmount(invoice.total), invoice.currency)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.issuedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
