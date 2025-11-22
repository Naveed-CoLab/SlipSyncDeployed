package com.slipsync.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderDetailDto(
        UUID id,
        String orderNumber,
        String status,
        UUID customerId,
        String customerName,
        String customerEmail,
        String customerPhone,
        BigDecimal subtotal,
        BigDecimal discountsTotal,
        BigDecimal taxesTotal,
        BigDecimal totalAmount,
        String currency,
        LocalDateTime placedAt,
        LocalDateTime fulfilledAt,
        List<OrderItemDetailDto> items
) {
}

