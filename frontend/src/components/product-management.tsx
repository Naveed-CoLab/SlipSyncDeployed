import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package, Box, Warehouse, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'

interface Product {
  id: string
  name: string
  sku: string | null
  description: string | null
  active: boolean
  categoryId: string | null
  storeId: string | null
  createdAt: string
}

interface ProductVariant {
  id: string
  productId?: string
  product?: {
    id: string
    name: string
  }
  sku: string | null
  barcode: string | null
  price: number
  cost: number | null
  createdAt: string
}

interface Inventory {
  id: string
  storeId: string
  productVariantId: string
  productId?: string
  productName?: string
  variantSku?: string
  quantity: number
  reserved: number
  reorderPoint: number | null
  updatedAt: string
}

interface Category {
  id: string
  name: string
}

interface ProductManagementProps {
  apiBaseUrl: string
  token: string | null
  storeId: string | null
  currency: string
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
    return `$${value.toFixed(2)}`
  }
}

export function ProductManagement({
  apiBaseUrl,
  token,
  storeId,
  currency,
  userRole,
  storeAccess,
}: ProductManagementProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')
  const [authError, setAuthError] = useState(false)

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    active: true,
    categoryId: '',
  })
  const [productFormErrors, setProductFormErrors] = useState({
    name: '',
  })

  // Variant dialog state
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [variantForm, setVariantForm] = useState({
    productId: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    initialStock: '',
    reorderPoint: '',
  })

  // Inventory dialog state
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [editingInventory, setEditingInventory] = useState<Inventory | null>(null)
  const [inventoryForm, setInventoryForm] = useState({
    quantity: '',
    reserved: '',
    reorderPoint: '',
  })

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteType, setDeleteType] = useState<'product' | 'variant' | null>(null)
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const fetchProducts = async () => {
    if (!token) {
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/products`, {
        headers: buildHeaders(),
      })
      if (response.status === 401) {
        setAuthError(true)
        throw new Error('Authentication required. Please refresh the page or try again.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data)
    } catch (error: any) {
      if (error.message.includes('Authentication')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to load products. Please try again later.')
      }
    }
  }

  const fetchVariants = async (productId?: string) => {
    if (!token) {
      return
    }
    try {
      const url = productId
        ? `${apiBaseUrl}/api/variants?productId=${productId}`
        : `${apiBaseUrl}/api/variants`
      const response = await fetch(url, {
        headers: buildHeaders(),
      })
      if (response.status === 401) {
        setAuthError(true)
        throw new Error('Authentication required. Please refresh the page or try again.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch variants')
      }
      const data = await response.json()
      setVariants(data)
    } catch (error: any) {
      if (error.message.includes('Authentication')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to load variants. Please try again later.')
      }
    }
  }

  const fetchInventory = async () => {
    if (!storeId) return
    if (!token) {
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/inventory`, {
        headers: buildHeaders(),
      })
      if (response.status === 401) {
        setAuthError(true)
        throw new Error('Authentication required. Please refresh the page or try again.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch inventory')
      }
      const data = await response.json()
      setInventory(data)
    } catch (error: any) {
      if (error.message.includes('Authentication')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to load inventory. Please try again later.')
      }
    }
  }

  const fetchCategories = async () => {
    if (!token) {
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/categories`, {
        headers: buildHeaders(),
      })
      if (response.status === 401) {
        // Categories are optional, so we don't show an error toast
        return
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to fetch categories')
      }
      const data = await response.json()
      setCategories(data)
    } catch (error: any) {
      // Categories are optional, so we don't show an error toast
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
      await Promise.all([fetchProducts(), fetchVariants(), fetchInventory(), fetchCategories()])
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [storeId, token, userRole, storeAccess])

  const validateProductForm = () => {
    const errors = {
      name: '',
    }
    let isValid = true

    if (!productForm.name.trim()) {
      errors.name = 'Name is required'
      isValid = false
    }

    setProductFormErrors(errors)
    return isValid
  }

  const handleCreateProduct = async () => {
    if (!validateProductForm()) return

    try {
      const response = await fetch(`${apiBaseUrl}/api/products`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: productForm.name,
          sku: productForm.sku || undefined,
          description: productForm.description || undefined,
          active: productForm.active,
          categoryId: productForm.categoryId && productForm.categoryId !== 'none' ? productForm.categoryId : undefined,
          price: 0, // Will be set via variant
          initialStock: 0,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Product created successfully')
      setProductDialogOpen(false)
      setProductForm({ name: '', sku: '', description: '', active: true, categoryId: '' })
      setProductFormErrors({ name: '' })
      await fetchProducts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create product')
    }
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    if (!validateProductForm()) return

    try {
      const response = await fetch(`${apiBaseUrl}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: productForm.name,
          sku: productForm.sku || undefined,
          description: productForm.description || undefined,
          active: productForm.active,
          categoryId: productForm.categoryId && productForm.categoryId !== 'none' ? productForm.categoryId : undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Product updated successfully')
      setProductDialogOpen(false)
      setEditingProduct(null)
      setProductForm({ name: '', sku: '', description: '', active: true, categoryId: '' })
      setProductFormErrors({ name: '' })
      await fetchProducts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product')
    }
  }

  const handleDeleteProduct = (id: string, name: string) => {
    setDeleteType('product')
    setItemToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const confirmDeleteProduct = async () => {
    if (!itemToDelete || deleteType !== 'product') return
    setDeleting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/products/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })
      if (!response.ok) {
        const error = await response.text()
        // Check if it's a constraint violation error
        if (response.status === 400 && error.includes('order')) {
          toast.error(error, { duration: 5000 })
          setDeleteDialogOpen(false)
        } else {
          throw new Error(error)
        }
        return
      }
      toast.success('Product deleted successfully')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      setDeleteType(null)
      await fetchProducts()
      await fetchVariants()
      await fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product')
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateVariant = async () => {
    if (!variantForm.productId) {
      toast.error('Please select a product')
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/variants`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          productId: variantForm.productId,
          sku: variantForm.sku || undefined,
          barcode: variantForm.barcode || undefined,
          price: parseFloat(variantForm.price),
          cost: variantForm.cost ? parseFloat(variantForm.cost) : undefined,
          initialStock: variantForm.initialStock ? parseInt(variantForm.initialStock) : undefined,
          reorderPoint: variantForm.reorderPoint ? parseInt(variantForm.reorderPoint) : undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Variant created successfully')
      setVariantDialogOpen(false)
      setVariantForm({
        productId: '',
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        initialStock: '',
        reorderPoint: '',
      })
      await fetchVariants()
      await fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create variant')
    }
  }

  const handleUpdateVariant = async () => {
    if (!editingVariant) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/variants/${editingVariant.id}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          sku: variantForm.sku || undefined,
          barcode: variantForm.barcode || undefined,
          price: parseFloat(variantForm.price),
          cost: variantForm.cost ? parseFloat(variantForm.cost) : undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Variant updated successfully')
      setVariantDialogOpen(false)
      setEditingVariant(null)
      setVariantForm({
        productId: '',
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        initialStock: '',
        reorderPoint: '',
      })
      await fetchVariants()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update variant')
    }
  }

  const handleDeleteVariant = (id: string, name: string) => {
    setDeleteType('variant')
    setItemToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const confirmDeleteVariant = async () => {
    if (!itemToDelete || deleteType !== 'variant') return
    setDeleting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/variants/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      })
      if (!response.ok) {
        const error = await response.text()
        // Check if it's a constraint violation error
        if (response.status === 400 && error.includes('order')) {
          toast.error(error, { duration: 5000 })
          setDeleteDialogOpen(false)
        } else {
          throw new Error(error)
        }
        return
      }
      toast.success('Variant deleted successfully')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      setDeleteType(null)
      await fetchVariants()
      await fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete variant')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpdateInventory = async () => {
    if (!editingInventory) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/inventory/${editingInventory.id}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          quantity: parseInt(inventoryForm.quantity),
          reserved: parseInt(inventoryForm.reserved),
          reorderPoint: inventoryForm.reorderPoint ? parseInt(inventoryForm.reorderPoint) : undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }
      toast.success('Inventory updated successfully')
      setInventoryDialogOpen(false)
      setEditingInventory(null)
      setInventoryForm({ quantity: '', reserved: '', reorderPoint: '' })
      await fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update inventory')
    }
  }

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        active: product.active,
        categoryId: product.categoryId || '',
      })
    } else {
      setEditingProduct(null)
      setEditingProduct(null)
      setProductForm({ name: '', sku: '', description: '', active: true, categoryId: '' })
    }
    setProductFormErrors({ name: '' })
    setProductDialogOpen(true)
  }

  const openVariantDialog = (variant?: ProductVariant) => {
    if (variant) {
      setEditingVariant(variant)
      const productId = variant.productId || variant.product?.id || ''
      setVariantForm({
        productId,
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        price: variant.price.toString(),
        cost: variant.cost?.toString() || '',
        initialStock: '',
        reorderPoint: '',
      })
    } else {
      setEditingVariant(null)
      setVariantForm({
        productId: '',
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        initialStock: '',
        reorderPoint: '',
      })
    }
    setVariantDialogOpen(true)
  }

  const openInventoryDialog = (inv: Inventory) => {
    setEditingInventory(inv)
    setInventoryForm({
      quantity: inv.quantity.toString(),
      reserved: inv.reserved.toString(),
      reorderPoint: inv.reorderPoint?.toString() || '',
    })
    setInventoryDialogOpen(true)
  }

  const getProductName = (variant: ProductVariant) => {
    if (variant.product) {
      return variant.product.name
    }
    const productId = variant.productId || ''
    const product = products.find((p) => p.id === productId)
    return product?.name || 'Unknown Product'
  }

  if (loading && !authError) {
    return (
      <div className="flex-1 px-4 pb-12 pt-4 lg:px-8 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Product Management</CardTitle>
            <CardDescription>Manage products, variants, and inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="products">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="products">
                  <Package className="mr-2 h-4 w-4" />
                  Products
                </TabsTrigger>
                <TabsTrigger value="variants">
                  <Box className="mr-2 h-4 w-4" />
                  Variants
                </TabsTrigger>
                <TabsTrigger value="inventory">
                  <Warehouse className="mr-2 h-4 w-4" />
                  Inventory
                </TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TableSkeleton columnCount={5} rowCount={5} />
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authError || !token) {
    return (
      <div className="flex-1 px-2 pb-12 pt-4 lg:px-4 lg:pt-6">
        <Card className="rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Product Management</CardTitle>
            <CardDescription>Authentication required</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              {!token
                ? 'Waiting for authentication token. This may be due to Supabase maintenance.'
                : 'Authentication failed. Please try again.'}
            </p>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
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
          <CardTitle className="text-xl font-semibold">Product Management</CardTitle>
          <CardDescription>Manage products, variants, and inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products">
                <Package className="mr-2 h-4 w-4" />
                Products
              </TabsTrigger>
              <TabsTrigger value="variants">
                <Box className="mr-2 h-4 w-4" />
                Variants
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <Warehouse className="mr-2 h-4 w-4" />
                Inventory
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4">
              <div className="flex justify-end mb-4">
                <Button onClick={() => openProductDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>
              {products.length === 0 ? (
                <EmptyState title="No products" description="Create your first product to get started" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-semibold">{product.name}</TableCell>
                        <TableCell>{product.sku || '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{product.description || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={product.active ? 'default' : 'secondary'}>
                            {product.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openProductDialog(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="variants" className="mt-4">
              <div className="flex justify-end mb-4">
                <Button onClick={() => openVariantDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variant
                </Button>
              </div>
              {variants.length === 0 ? (
                <EmptyState title="No variants" description="Create your first variant to get started" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-semibold">{getProductName(variant)}</TableCell>
                        <TableCell>{variant.sku || '—'}</TableCell>
                        <TableCell>{variant.barcode || '—'}</TableCell>
                        <TableCell>{formatMoney(variant.price, currency)}</TableCell>
                        <TableCell>{variant.cost ? formatMoney(variant.cost, currency) : '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openVariantDialog(variant)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVariant(variant.id, variant.sku || 'Variant')}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="mt-4">
              {!storeId ? (
                <EmptyState title="No store selected" description="Please select a store to view inventory" />
              ) : inventory.length === 0 ? (
                <EmptyState title="No inventory" description="Inventory will appear here when products are added" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Variant SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Reorder Point</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-semibold">
                          {inv.productName || 'Unknown'}
                        </TableCell>
                        <TableCell>{inv.variantSku || '—'}</TableCell>
                        <TableCell>{inv.quantity}</TableCell>
                        <TableCell>{inv.reserved}</TableCell>
                        <TableCell>{inv.reorderPoint ?? '—'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openInventoryDialog(inv)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product information' : 'Add a new product to your catalog'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={(e) => {
                  setProductForm({ ...productForm, name: e.target.value })
                  if (productFormErrors.name) {
                    setProductFormErrors({ ...productFormErrors, name: '' })
                  }
                }}
                placeholder="Product name"
                className={productFormErrors.name ? 'border-destructive' : ''}
              />
              {productFormErrors.name && (
                <p className="text-sm text-destructive">{productFormErrors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                placeholder="SKU"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Product description"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={productForm.categoryId}
                onValueChange={(value) => setProductForm({ ...productForm, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={productForm.active}
                onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}>
              {editingProduct ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Edit Variant' : 'Create Variant'}</DialogTitle>
            <DialogDescription>
              {editingVariant ? 'Update variant information' : 'Add a new variant to a product'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingVariant && (
              <div className="grid gap-2">
                <Label htmlFor="productId">Product *</Label>
                <Select
                  value={variantForm.productId}
                  onValueChange={(value) => setVariantForm({ ...variantForm, productId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="variant-sku">SKU</Label>
              <Input
                id="variant-sku"
                value={variantForm.sku}
                onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                placeholder="Variant SKU"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={variantForm.barcode}
                onChange={(e) => setVariantForm({ ...variantForm, barcode: e.target.value })}
                placeholder="Barcode"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={variantForm.price}
                onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={variantForm.cost}
                onChange={(e) => setVariantForm({ ...variantForm, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            {!editingVariant && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="initialStock">Initial Stock</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    value={variantForm.initialStock}
                    onChange={(e) => setVariantForm({ ...variantForm, initialStock: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    value={variantForm.reorderPoint}
                    onChange={(e) => setVariantForm({ ...variantForm, reorderPoint: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingVariant ? handleUpdateVariant : handleCreateVariant}>
              {editingVariant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Inventory</DialogTitle>
            <DialogDescription>Adjust inventory quantities and settings</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={inventoryForm.quantity}
                onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reserved">Reserved</Label>
              <Input
                id="reserved"
                type="number"
                value={inventoryForm.reserved}
                onChange={(e) => setInventoryForm({ ...inventoryForm, reserved: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inventory-reorderPoint">Reorder Point</Label>
              <Input
                id="inventory-reorderPoint"
                type="number"
                value={inventoryForm.reorderPoint}
                onChange={(e) => setInventoryForm({ ...inventoryForm, reorderPoint: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateInventory}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (deleteType === 'product') {
            await confirmDeleteProduct()
          } else if (deleteType === 'variant') {
            await confirmDeleteVariant()
          }
        }}
        itemName={itemToDelete?.name}
        itemType={deleteType === 'product' ? 'product' : 'variant'}
        description={
          deleteType === 'product'
            ? `Are you sure you want to delete "${itemToDelete?.name}"? This will also delete all variants and inventory associated with this product. This action cannot be undone.`
            : `Are you sure you want to delete this variant? This will also delete related inventory. This action cannot be undone.`
        }
        isLoading={deleting}
      />
    </div>
  )
}

