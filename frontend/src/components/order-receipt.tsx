import { useEffect, useState } from 'react'
import { X, Receipt, Calendar, User, Package } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

interface OrderItem {
  id: string
  productVariantId: string
  productId: string
  productName: string
  variantSku: string | null
  variantBarcode: string | null
  quantity: number
  unitPrice: number
  discountsTotal: number
  taxesTotal: number
  totalPrice: number
}

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  customerId: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  subtotal: number
  discountsTotal: number
  taxesTotal: number
  totalAmount: number
  currency: string
  placedAt: string
  fulfilledAt: string | null
  items: OrderItem[]
}

interface OrderReceiptProps {
  apiBaseUrl: string
  token: string | null
  orderId: string | null
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole?: string | null
  storeAccess?: string
}

const formatMoney = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export function OrderReceipt({
  apiBaseUrl,
  token,
  orderId,
  currency,
  open,
  onOpenChange,
  userRole,
  storeAccess,
}: OrderReceiptProps) {
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (open && orderId && token) {
      setLoading(true)
      fetch(`${apiBaseUrl}/api/orders/${orderId}`, {
        headers: buildHeaders(),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch order details')
          }
          return res.json()
        })
        .then((data) => {
          setOrderDetail(data)
        })
        .catch((error) => {
          toast.error('Failed to load order details')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setOrderDetail(null)
    }
  }, [open, orderId, token, apiBaseUrl, userRole, storeAccess])

  if (!orderDetail && !loading) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Order Receipt
          </DialogTitle>
          <DialogDescription>Order details and items</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted-foreground">Loading order details...</div>
          </div>
        ) : orderDetail ? (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{orderDetail.orderNumber}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="capitalize">
                      {orderDetail.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      {formatDate(orderDetail.placedAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatMoney(orderDetail.totalAmount, orderDetail.currency || currency)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                </div>
              </div>

              {/* Customer Info */}
              {orderDetail.customerId && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Customer Information</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {orderDetail.customerName}
                    </div>
                    {orderDetail.customerEmail && (
                      <div>
                        <span className="font-medium">Email:</span> {orderDetail.customerEmail}
                      </div>
                    )}
                    {orderDetail.customerPhone && (
                      <div>
                        <span className="font-medium">Phone:</span> {orderDetail.customerPhone}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">Order Items ({orderDetail.items.length})</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetail.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        {item.variantSku && (
                          <div className="text-xs text-muted-foreground">SKU: {item.variantSku}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(item.unitPrice, orderDetail.currency || currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(item.totalPrice, orderDetail.currency || currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatMoney(orderDetail.subtotal, orderDetail.currency || currency)}
                </span>
              </div>
              {orderDetail.discountsTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discounts</span>
                  <span className="font-medium text-red-600">
                    -{formatMoney(orderDetail.discountsTotal, orderDetail.currency || currency)}
                  </span>
                </div>
              )}
              {orderDetail.taxesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-medium">
                    {formatMoney(orderDetail.taxesTotal, orderDetail.currency || currency)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatMoney(orderDetail.totalAmount, orderDetail.currency || currency)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

