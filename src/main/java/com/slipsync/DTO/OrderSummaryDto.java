package com.slipsync.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OrderSummaryDto(
        UUID id,
        String orderNumber,
        String status,
        BigDecimal subtotal,
        BigDecimal taxesTotal,
        BigDecimal totalAmount,
        LocalDateTime placedAt,
        String customerName,
        int itemCount,
        String currency) {
}


