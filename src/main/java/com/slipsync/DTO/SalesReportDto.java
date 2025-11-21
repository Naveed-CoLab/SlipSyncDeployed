package com.slipsync.DTO;

import java.math.BigDecimal;

public record SalesReportDto(
        String range,
        BigDecimal grossSales,
        BigDecimal discountsTotal,
        BigDecimal taxesTotal,
        BigDecimal netSales,
        long orderCount) {
}

