import jsPDF from 'jspdf'

interface OrderItem {
    name: string
    sku: string
    quantity: number
    price: number
}

interface OrderData {
    orderNumber?: string
    items: OrderItem[]
    subtotal: number
    discount: number
    tax: number
    total: number
    currency: string
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    merchantName?: string
    storeName?: string
    notes?: string
}

export function generateOrderPDF(orderData: OrderData): void {
    const doc = new jsPDF()

    // Set up fonts and colors
    const primaryColor: [number, number, number] = [0, 0, 0]
    const secondaryColor: [number, number, number] = [100, 100, 100]

    let yPosition = 20

    // Header
    doc.setFontSize(24)
    doc.setTextColor(...primaryColor)
    doc.text('ORDER RECEIPT', 105, yPosition, { align: 'center' })

    yPosition += 15

    // Order details
    doc.setFontSize(10)
    doc.setTextColor(...secondaryColor)
    if (orderData.orderNumber) {
        doc.text(`Order #: ${orderData.orderNumber}`, 20, yPosition)
        yPosition += 6
    }

    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPosition)
    yPosition += 6

    if (orderData.merchantName) {
        doc.text(`Merchant: ${orderData.merchantName}`, 20, yPosition)
        yPosition += 6
    }
    if (orderData.storeName) {
        doc.text(`Store: ${orderData.storeName}`, 20, yPosition)
        yPosition += 6
    }

    yPosition += 5

    // Customer info (if available)
    if (orderData.customerName) {
        doc.setFontSize(12)
        doc.setTextColor(...primaryColor)
        doc.text('Customer Information', 20, yPosition)
        yPosition += 7

        doc.setFontSize(10)
        doc.setTextColor(...secondaryColor)
        doc.text(`Name: ${orderData.customerName}`, 20, yPosition)
        yPosition += 6

        if (orderData.customerEmail) {
            doc.text(`Email: ${orderData.customerEmail}`, 20, yPosition)
            yPosition += 6
        }

        if (orderData.customerPhone) {
            doc.text(`Phone: ${orderData.customerPhone}`, 20, yPosition)
            yPosition += 6
        }

        yPosition += 5
    }

    // Line separator
    doc.setDrawColor(200, 200, 200)
    doc.line(20, yPosition, 190, yPosition)
    yPosition += 10

    // Items header
    doc.setFontSize(12)
    doc.setTextColor(...primaryColor)
    doc.text('Items', 20, yPosition)
    yPosition += 8

    // Table header
    doc.setFontSize(9)
    doc.setTextColor(...secondaryColor)
    doc.text('Product', 20, yPosition)
    doc.text('SKU', 80, yPosition)
    doc.text('Qty', 130, yPosition)
    doc.text('Price', 150, yPosition)
    doc.text('Total', 175, yPosition, { align: 'right' })
    yPosition += 5

    // Line under header
    doc.line(20, yPosition, 190, yPosition)
    yPosition += 7

    // Items
    doc.setFontSize(9)
    doc.setTextColor(...primaryColor)

    for (const item of orderData.items) {
        // Check if we need a new page
        if (yPosition > 250) {
            doc.addPage()
            yPosition = 20
        }

        const itemTotal = item.price * item.quantity

        doc.text(item.name.substring(0, 25), 20, yPosition)
        doc.text(item.sku || 'N/A', 80, yPosition)
        doc.text(item.quantity.toString(), 130, yPosition)
        doc.text(formatCurrency(item.price, orderData.currency), 150, yPosition)
        doc.text(formatCurrency(itemTotal, orderData.currency), 190, yPosition, { align: 'right' })

        yPosition += 7
    }

    yPosition += 5

    // Line before totals
    doc.setDrawColor(200, 200, 200)
    doc.line(20, yPosition, 190, yPosition)
    yPosition += 10

    // Totals
    doc.setFontSize(10)
    doc.setTextColor(...secondaryColor)

    doc.text('Subtotal:', 130, yPosition)
    doc.text(formatCurrency(orderData.subtotal, orderData.currency), 190, yPosition, { align: 'right' })
    yPosition += 7

    if (orderData.discount > 0) {
        doc.text('Discount:', 130, yPosition)
        doc.text(`-${formatCurrency(orderData.discount, orderData.currency)}`, 190, yPosition, { align: 'right' })
        yPosition += 7
    }

    if (orderData.tax > 0) {
        doc.text('Tax:', 130, yPosition)
        doc.text(formatCurrency(orderData.tax, orderData.currency), 190, yPosition, { align: 'right' })
        yPosition += 7
    }

    yPosition += 3

    // Total
    doc.setFontSize(12)
    doc.setTextColor(...primaryColor)
    doc.text('Total:', 130, yPosition)
    doc.text(formatCurrency(orderData.total, orderData.currency), 190, yPosition, { align: 'right' })

    // Notes (if available)
    if (orderData.notes) {
        yPosition += 15
        doc.setFontSize(10)
        doc.setTextColor(...secondaryColor)
        doc.text('Notes:', 20, yPosition)
        yPosition += 6
        doc.setFontSize(9)
        doc.text(orderData.notes, 20, yPosition)
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(...secondaryColor)
        doc.text(
            `Page ${i} of ${pageCount}`,
            105,
            285,
            { align: 'center' }
        )
    }

    // Download the PDF
    const fileName = orderData.orderNumber
        ? `order-${orderData.orderNumber}.pdf`
        : `order-${new Date().getTime()}.pdf`

    doc.save(fileName)
}

function formatCurrency(value: number, currency: string): string {
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
