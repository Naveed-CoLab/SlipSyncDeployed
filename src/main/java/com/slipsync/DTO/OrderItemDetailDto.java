package com.slipsync.DTO;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemDetailDto(
        UUID id,
        UUID productVariantId,
        UUID productId,
        String productName,
        String variantSku,
        String variantBarcode,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal discountsTotal,
        BigDecimal taxesTotal,
        BigDecimal totalPrice
) {
}

