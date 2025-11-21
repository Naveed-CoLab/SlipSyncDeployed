export interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  subtotal: number | string
  taxesTotal: number | string
  totalAmount: number | string
  placedAt: string | null
  customerName: string
  itemCount: number
  currency: string
}

export interface DeviceStatus {
  status: string
  activeDevices: number
}

export interface ProductInventoryEntry {
  inventoryId: string | null
  productId: string
  variantId: string
  productName: string
  sku: string
  barcode?: string | null
  price: number | string
  cost?: number | string | null
  quantity: number
  reorderPoint: number | null
  createdAt: string | null
}

export interface InvoiceSummary {
  id: string
  invoiceNumber: string
  orderNumber?: string | null
  total: number | string
  issuedAt: string | null
  currency: string
}

