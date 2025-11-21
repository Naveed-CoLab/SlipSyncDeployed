import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Download,
  PackagePlus,
  Percent,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Warehouse,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import type { ProductInventoryEntry } from '@/types/dashboard'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'

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
  canManage: boolean
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
  canManage,
  userRole,
  storeAccess,
  onRefresh,
}: OrderProcessingProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [qtyInput, setQtyInput] = useState(1)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [processingOrder, setProcessingOrder] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [adjustingStock, setAdjustingStock] = useState(false)
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    initialStock: '',
    reorderPoint: '',
    description: '',
    barcode: '',
  })
  const [adjustForm, setAdjustForm] = useState({
    variantId: '',
    quantityChange: '',
    reorderPoint: '',
  })
  const [reports, setReports] = useState<{ daily: SalesSummary | null; monthly: SalesSummary | null }>({
    daily: null,
    monthly: null,
  })
  const [fetchingReports, setFetchingReports] = useState(false)
  const [reportVersion, setReportVersion] = useState(0)

  const productOptions = useMemo(() => products ?? [], [products])

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

  useEffect(() => {
    if (!token || !storeId || !canManage) {
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
        console.error(error)
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
  }, [apiBaseUrl, token, storeId, canManage, reportVersion, userRole, storeAccess])

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
    setDiscountAmount(0)
    setTaxRate(0)
    setNotes('')
  }

  const handleProcessOrder = async () => {
    if (!token || !storeId) {
      toast.error('Missing authentication token')
      return
    }
    if (!cart.length) {
      toast.error('Add at least one product to process the order')
      return
    }
    try {
      setProcessingOrder(true)
      const payload = {
        items: cart.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        discountAmount: normalizedDiscount,
        taxRate,
        notes,
      }
      const res = await fetch(`${apiBaseUrl}/api/orders`, {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Order failed')
      }
      toast.success('Order processed successfully')
      resetCart()
      onRefresh()
      refreshReports()
    } catch (error) {
      console.error(error)
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

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token || !storeId) return
    try {
      setCreatingProduct(true)
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        cost: productForm.cost ? Number(productForm.cost) : undefined,
        initialStock: productForm.initialStock || '0',
        reorderPoint: productForm.reorderPoint || undefined,
      }
      const res = await fetch(`${apiBaseUrl}/api/products`, {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      toast.success('Product created')
      setProductForm({
        name: '',
        sku: '',
        price: '',
        cost: '',
        initialStock: '',
        reorderPoint: '',
        description: '',
        barcode: '',
      })
      onRefresh()
      refreshReports()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to create product')
    } finally {
      setCreatingProduct(false)
    }
  }

  const handleAdjustStock = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token || !storeId) return
    if (!adjustForm.variantId) {
      toast.error('Select a product to adjust')
      return
    }
    try {
      setAdjustingStock(true)
      const payload = {
        productVariantId: adjustForm.variantId,
        quantityChange: Number(adjustForm.quantityChange || 0),
        reorderPoint: adjustForm.reorderPoint ? Number(adjustForm.reorderPoint) : undefined,
      }
      const res = await fetch(`${apiBaseUrl}/api/inventory/adjust`, {
        method: 'PUT',
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      toast.success('Inventory updated')
      setAdjustForm({
        variantId: '',
        quantityChange: '',
        reorderPoint: '',
      })
      onRefresh()
      refreshReports()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to adjust inventory')
    } finally {
      setAdjustingStock(false)
    }
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
      console.error(error)
      toast.error('Unable to download CSV')
    }
  }

  if (!canManage) {
    return (
      <Card className="rounded-3xl border border-dashed border-border/60 bg-card/60 shadow-none">
        <CardHeader>
          <CardTitle>Order processing</CardTitle>
          <CardDescription>Only admins and employees can access POS tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Access restricted"
            description="Your current organization role does not allow POS operations."
          />
        </CardContent>
      </Card>
    )
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="mt-1 w-full justify-between text-left">
                      {selectedVariantId
                        ? productOptions.find((p) => p.variantId === selectedVariantId)?.productName
                        : 'Search by name or SKU'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" side="bottom" align="start">
                    <Command>
                      <CommandInput placeholder="Type to filter..." />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {productOptions.map((item) => (
                            <CommandItem
                              key={item.variantId}
                              value={item.variantId}
                              onSelect={(value) => setSelectedVariantId(value)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.sku} • In stock: {item.quantity ?? 0}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      <TableCell colSpan={4}>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Add products to start building an order.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
            <Button disabled={!cart.length || processingOrder} onClick={handleProcessOrder} className="flex-1 min-w-[200px]">
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="size-4" />
              Quick add product
            </CardTitle>
            <CardDescription>Create a SKU and optional opening stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleCreateProduct}>
              <div>
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  required
                  value={productForm.name}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  required
                  value={productForm.sku}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="product-price">Price ({currency})</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="product-cost">Cost</Label>
                  <Input
                    id="product-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.cost}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, cost: event.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="initial-stock">Initial stock</Label>
                  <Input
                    id="initial-stock"
                    type="number"
                    min={0}
                    value={productForm.initialStock}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, initialStock: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="reorder-point">Reorder point</Label>
                  <Input
                    id="reorder-point"
                    type="number"
                    min={0}
                    value={productForm.reorderPoint}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, reorderPoint: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="product-barcode">Barcode</Label>
                <Input
                  id="product-barcode"
                  value={productForm.barcode}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, barcode: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="product-description">Description</Label>
                <textarea
                  id="product-description"
                  value={productForm.description}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-transparent p-2 text-sm shadow-sm"
                  rows={3}
                  placeholder="Optional details"
                />
              </div>
              <Button type="submit" disabled={creatingProduct} className="w-full">
                <PackagePlus className="mr-2 size-4" />
                {creatingProduct ? 'Creating...' : 'Add product'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-4" />
              Stock adjustment
            </CardTitle>
            <CardDescription>Increase or decrease inventory for any SKU.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleAdjustStock}>
              <div>
                <Label>Product</Label>
                <Select
                  value={adjustForm.variantId}
                  onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, variantId: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((item) => (
                      <SelectItem key={item.variantId} value={item.variantId}>
                        {item.productName} · {item.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="quantity-change">Quantity change</Label>
                  <Input
                    id="quantity-change"
                    type="number"
                    value={adjustForm.quantityChange}
                    onChange={(event) => setAdjustForm((prev) => ({ ...prev, quantityChange: event.target.value }))}
                    placeholder="+5 or -3"
                  />
                </div>
                <div>
                  <Label htmlFor="adjust-reorder">Reorder point</Label>
                  <Input
                    id="adjust-reorder"
                    type="number"
                    value={adjustForm.reorderPoint}
                    onChange={(event) => setAdjustForm((prev) => ({ ...prev, reorderPoint: event.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" disabled={adjustingStock} className="w-full" variant="outline">
                <RefreshCcw className="mr-2 size-4" />
                {adjustingStock ? 'Updating...' : 'Apply adjustment'}
              </Button>
            </form>
          </CardContent>
        </Card>

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
    </div>
  )
}

