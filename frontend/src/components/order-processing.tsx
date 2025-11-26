import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Download,
  Percent,
  Plus,
  ShoppingCart,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import type { ProductInventoryEntry } from '@/types/dashboard'
import { Printer, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type CartItem = {
  variantId: string
  name: string
  sku: string
  price: number
  quantity: number
  available: number
}

type SalesSummary = {
  range: 'daily' | 'monthly'
  grossSales: number
  discountsTotal: number
  taxesTotal: number
  netSales: number
  orderCount: number
}

interface OrderProcessingProps {
  apiBaseUrl: string
  token: string | null
  storeId: string | null
  storeName?: string | null
  products: ProductInventoryEntry[]
  currency: string
  userRole?: string | null
  storeAccess?: string
  onRefresh(): void
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatMoney = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return numberFormatter.format(value)
  }
}

export function OrderProcessing({
  apiBaseUrl,
  token,
  storeId,
  storeName,
  products,
  currency,
  userRole,
  storeAccess,
  onRefresh,
}: OrderProcessingProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [devices, setDevices] = useState<Array<{ deviceIdentifier: string; name: string }>>([])
  const [deviceStatus, setDeviceStatus] = useState<'ONLINE' | 'OFFLINE' | null>(null)
  const [showDeviceDialog, setShowDeviceDialog] = useState(false)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [qtyInput, setQtyInput] = useState(1)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null }>>([])
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', email: '', phone: '' })
  const [processingOrder, setProcessingOrder] = useState(false)
  const [reports, setReports] = useState<{ daily: SalesSummary | null; monthly: SalesSummary | null }>({
    daily: null,
    monthly: null,
  })
  const [fetchingReports, setFetchingReports] = useState(false)
  const [reportVersion, setReportVersion] = useState(0)

  const productOptions = useMemo(() => products ?? [], [products])

  // 2. Add function to fetch available print devices:
const fetchDeviceStatus = async () => {
  if (!token || !storeId) {
    toast.error('Missing authentication')
    return
  }
  
  setLoadingDevices(true)
  try {
    const res = await fetch(`${apiBaseUrl}/api/print-devices/status`, {
      headers: buildHeaders(),
    })
    
    if (!res.ok) {
      throw new Error('Failed to fetch devices')
    }
    
    const data = await res.json()
    setDevices(data.devices || [])
    setDeviceStatus(data.status)
    
    // Auto-select if only one device available
    if (data.devices && data.devices.length === 1) {
      setSelectedDevice(data.devices[0].deviceIdentifier)
    }
  } catch (error) {
    toast.error('Failed to load print devices')
    setDevices([])
    setDeviceStatus('OFFLINE')
  } finally {
    setLoadingDevices(false)
  }
}
  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return productOptions
    const query = productSearchQuery.toLowerCase()
    return productOptions.filter(
      (item) =>
        item.productName.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query))
    )
  }, [productOptions, productSearchQuery])

  // Helper to build headers with role and store_access
  const buildHeaders = (includeContentType = false): Record<string, string> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token || ''}`,
      'X-Store-Id': storeId || '',
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
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  )

  const normalizedDiscount = Math.min(Math.max(discountAmount, 0), subtotal)
  const taxableBase = Math.max(subtotal - normalizedDiscount, 0)
  const taxAmount = Number(((taxableBase * Math.max(taxRate, 0)) / 100).toFixed(2))
  const total = taxableBase + taxAmount

  // Fetch customers
  useEffect(() => {
    if (!token || !storeId) return
    async function fetchCustomers() {
      try {
        const headers = buildHeaders()
        const res = await fetch(`${apiBaseUrl}/api/customers`, { headers })
        if (res.ok) {
          const data = await res.json()
          setCustomers(data)
        }
      } catch (error) {
      }
    }
    fetchCustomers()
  }, [token, storeId, userRole, storeAccess])

  useEffect(() => {
    if (!token || !storeId) {
      return
    }
    let cancelled = false
    async function fetchReports() {
      try {
        setFetchingReports(true)
        const headers = buildHeaders()
        const [dailyRes, monthlyRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/reports/sales/summary?range=daily`, { headers }),
          fetch(`${apiBaseUrl}/api/reports/sales/summary?range=monthly`, { headers }),
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
  }, [apiBaseUrl, token, storeId, reportVersion, userRole, storeAccess])

  const handleAddToCart = () => {
    if (!selectedVariantId) {
      toast.error('Select a product to add')
      return
    }
    const product = productOptions.find((p) => p.variantId === selectedVariantId)
    if (!product) {
      toast.error('Product not found')
      return
    }
    const available = product.quantity ?? 0
    if (available <= 0) {
      toast.error(`${product.productName} is out of stock`)
      return
    }
    const sanitizedQty = Math.max(1, qtyInput)
    const existing = cart.find((item) => item.variantId === product.variantId)
    const nextQty = (existing?.quantity ?? 0) + sanitizedQty
    if (nextQty > available) {
      toast.error(`Only ${available} units available for ${product.productName}`)
      return
    }
    const price = typeof product.price === 'number' ? product.price : Number(product.price)
    const nextCart = existing
      ? cart.map((item) =>
        item.variantId === product.variantId ? { ...item, quantity: nextQty } : item,
      )
      : [
        ...cart,
        {
          variantId: product.variantId,
          name: product.productName,
          sku: product.sku,
          price,
          quantity: sanitizedQty,
          available,
        },
      ]
    setCart(nextCart)
    setSelectedVariantId(null)
    setQtyInput(1)
  }

  const handleQuantityChange = (variantId: string, qty: number) => {
    if (qty <= 0) return
    setCart((prev) =>
      prev.map((item) => {
        if (item.variantId !== variantId) return item
        if (item.available > 0 && qty > item.available) {
          toast.error(`Only ${item.available} units available for ${item.name}`)
          return item
        }
        return { ...item, quantity: qty }
      }),
    )
  }

  const handleRemove = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId))
  }

  const resetCart = () => {
    setCart([])
    setSelectedVariantId(null)
    setQtyInput(1)
    setDiscountAmount(0)
    setTaxRate(0)
    setNotes('')
    setSelectedCustomerId(null)
    setNewCustomerForm({ name: '', email: '', phone: '' })
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name.trim()) {
      toast.error('Customer name is required')
      return
    }
    setCustomerDialogOpen(false)
    // Customer will be created during order processing
    toast.success('Customer will be added to order')
  }

  const handleInitiateOrder = async () => {
  if (!token || !storeId) {
    toast.error('Missing authentication token')
    return
  }
  if (!cart.length) {
    toast.error('Add at least one product to process the order')
    return
  }
  
  // Fetch available devices first
  await fetchDeviceStatus()
  setShowDeviceDialog(true)
}

const handleProcessOrderWithPrint = async () => {
  if (!selectedDevice) {
    toast.error('Please select a print device')
    return
  }
  
  setProcessingOrder(true)
  setShowDeviceDialog(false)
  
  try {
    // Step 1: Create the order
    const payload: any = {
      items: cart.map((item) => ({
        productVariantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      discountAmount: normalizedDiscount,
      taxRate,
      notes,
    }

    if (selectedCustomerId && selectedCustomerId !== 'walk-in') {
      payload.customerId = selectedCustomerId
    } else if (newCustomerForm.name) {
      payload.customer = {
        name: newCustomerForm.name,
        email: newCustomerForm.email || undefined,
        phone: newCustomerForm.phone || undefined,
      }
    }
    
    const orderRes = await fetch(`${apiBaseUrl}/api/orders`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    })
    
    if (!orderRes.ok) {
      const text = await orderRes.text()
      throw new Error(text || 'Order failed')
    }
    
    const order = await orderRes.json()
    
    // Step 2: Create print job with selected device
    const printJobRes = await fetch(`${apiBaseUrl}/api/print-jobs/${order.id}`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({
        deviceIdentifier: selectedDevice,
      }),
    })
    
    if (!printJobRes.ok) {
      // Order was created but print job failed
      toast.warning('Order created but print job failed. You can retry printing from order details.')
    } else {
      toast.success('Order processed and sent to printer successfully!')
    }
    
    resetCart()
    setSelectedDevice(null)
    setSelectedCustomerId(null)
    setNewCustomerForm({ name: '', email: '', phone: '' })
    onRefresh()
    refreshReports()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to process order')
  } finally {
    setProcessingOrder(false)
  }
}

  const refreshReports = () => {
    if (!token || !storeId) return
    setReports({ daily: null, monthly: null })
    setReportVersion((prev) => prev + 1)
  }

  const handleExportCsv = async (range: 'daily' | 'monthly') => {
    if (!token || !storeId) return
    try {
      const res = await fetch(`${apiBaseUrl}/api/reports/sales/export?range=${range}`, {
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
  }


  return (
  <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
    <div className="space-y-6">
      <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-xl font-semibold">
            Process order <span className="text-base font-normal text-muted-foreground">for {storeName}</span>
          </CardTitle>
          <CardDescription>Select products, adjust quantities, and compute totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 md:flex-row md:items-end">
            <div className="flex-1">
              <Label className="flex items-center gap-1 text-xs uppercase tracking-wide">
                <ShoppingCart className="size-3" />
                Product
              </Label>
              <Button
                variant="outline"
                className="mt-1 w-full justify-between text-left font-normal"
                onClick={() => setProductDialogOpen(true)}
              >
                <span className="truncate">
                  {selectedVariantId
                    ? productOptions.find((p) => p.variantId === selectedVariantId)?.productName
                    : 'Search by name or SKU'}
                </span>
                <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </div>
            <div className="w-full md:w-32">
              <Label htmlFor="pos-qty">Qty</Label>
              <Input
                id="pos-qty"
                type="number"
                min={1}
                value={qtyInput}
                onChange={(event) => setQtyInput(Number(event.target.value))}
                className="mt-1"
              />
            </div>
            <Button onClick={handleAddToCart} className="md:w-40">
              <Plus className="mr-2 size-4" />
              Add to cart
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item) => (
                  <TableRow key={item.variantId}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </TableCell>
                    <TableCell>{formatMoney(item.price, currency)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => handleQuantityChange(item.variantId, Number(event.target.value))}
                        className="w-20"
                      />
                      {item.available > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">In stock: {item.available}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(item.price * item.quantity, currency)}
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(item.variantId)}>
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!cart.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Add products to start building an order.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Customer Selection */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <Label htmlFor="customer" className="mb-2 block">
              Customer (Optional)
            </Label>
            <div className="flex gap-2">
              <Select value={selectedCustomerId || 'walk-in'} onValueChange={(value) => {
                if (value === 'walk-in') {
                  setSelectedCustomerId(null)
                } else {
                  setSelectedCustomerId(value)
                }
                setNewCustomerForm({ name: '', email: '', phone: '' })
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select existing customer or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedCustomerId(null)
                  setCustomerDialogOpen(true)
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
            {newCustomerForm.name && !selectedCustomerId && (
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{newCustomerForm.name}</span>
                  {newCustomerForm.phone && <span className="text-muted-foreground">• {newCustomerForm.phone}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  New customer will be created with this order
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="discount">Discount amount</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                value={discountAmount}
                onChange={(event) => setDiscountAmount(Number(event.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="tax-rate" className="flex items-center gap-1">
                Tax rate %
                <Percent className="size-3 text-muted-foreground" />
              </Label>
              <Input
                id="tax-rate"
                type="number"
                min={0}
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1"
                placeholder="Optional memo"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Discounts</span>
              <span>-{formatMoney(normalizedDiscount, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Tax</span>
              <span>{formatMoney(taxAmount, currency)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-lg font-semibold">
              <span>Total due</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button 
            disabled={!cart.length || processingOrder} 
            onClick={handleInitiateOrder}
            className="flex-1 min-w-[200px]"
          >
            <ShoppingCart className="mr-2 size-4" />
            {processingOrder ? 'Processing...' : 'Process order'}
          </Button>
          <Button variant="ghost" onClick={resetCart} disabled={!cart.length}>
            Clear cart
          </Button>
        </CardFooter>
      </Card>
    </div>

    <div className="space-y-6">
      <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-4" />
            Sales snapshots
          </CardTitle>
          <CardDescription>Daily and monthly performance for this store.</CardDescription>
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
                      {summary ? formatMoney(Number(summary.netSales ?? 0), currency) : '—'}
                    </p>
                  </div>
                  <Badge variant="secondary">{summary?.orderCount ?? 0} orders</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Gross</p>
                    <p className="font-medium">
                      {summary ? formatMoney(Number(summary.grossSales ?? 0), currency) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Discounts</p>
                    <p className="font-medium">
                      {summary ? formatMoney(Number(summary.discountsTotal ?? 0), currency) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxes</p>
                    <p className="font-medium">
                      {summary ? formatMoney(Number(summary.taxesTotal ?? 0), currency) : '—'}
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
    </div>

    {/* Customer Creation Dialog */}
    <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Add customer information. This customer will be created when you process the order.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="customer-name">Name *</Label>
            <Input
              id="customer-name"
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={newCustomerForm.email}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
              placeholder="customer@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
              placeholder="+1234567890"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateCustomer}>Add Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Product Selection Dialog */}
    <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
          <DialogDescription>
            Search and select a product to add to the order
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="relative">
            <Input
              placeholder="Search by product name or SKU..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {productSearchQuery ? 'No products found matching your search' : 'No products available'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredProducts.map((item) => {
                  const isSelected = selectedVariantId === item.variantId
                  const hasStock = (item.quantity ?? 0) > 0
                  return (
                    <button
                      key={item.variantId}
                      type="button"
                      onClick={() => {
                        if (hasStock) {
                          setSelectedVariantId(item.variantId)
                          setProductDialogOpen(false)
                          setProductSearchQuery('')
                        }
                      }}
                      disabled={!hasStock}
                      className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                        isSelected ? 'bg-accent border-l-4 border-l-primary' : ''
                      } ${!hasStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.productName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            SKU: {item.sku || 'N/A'}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={hasStock ? 'secondary' : 'destructive'} className="text-xs">
                              {hasStock ? `In stock: ${item.quantity}` : 'Out of stock'}
                            </Badge>
                            <span className="text-xs font-medium text-muted-foreground">
                              {formatMoney(typeof item.price === 'number' ? item.price : Number(item.price), currency)}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setProductDialogOpen(false)
            setProductSearchQuery('')
          }}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Device Selection Dialog */}
    <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Select Print Device
          </DialogTitle>
          <DialogDescription>
            Choose where to print the receipt for this order
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {loadingDevices ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-3 text-sm text-muted-foreground">Loading devices...</p>
            </div>
          ) : deviceStatus === 'OFFLINE' || devices.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No devices available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Make sure at least one printer is online
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDeviceStatus}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.deviceIdentifier}
                  type="button"
                  onClick={() => setSelectedDevice(device.deviceIdentifier)}
                  className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                    selectedDevice === device.deviceIdentifier
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div
                    className={`rounded-md p-2 ${
                      selectedDevice === device.deviceIdentifier
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <Printer className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.deviceIdentifier}
                    </div>
                  </div>
                  {selectedDevice === device.deviceIdentifier && (
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeviceDialog(false)
              setSelectedDevice(null)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProcessOrderWithPrint}
            disabled={!selectedDevice || processingOrder}
          >
            {processingOrder ? 'Processing...' : 'Confirm & Print'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
)
}

