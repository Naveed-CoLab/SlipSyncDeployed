export type SalesSummary = {
    range: 'daily' | 'monthly'
    grossSales: number
    discountsTotal: number
    taxesTotal: number
    netSales: number
    orderCount: number
}
