package com.slipsync.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record ProductInventoryDto(
        UUID inventoryId,
        UUID productId,
        UUID variantId,
        String productName,
        String sku,
        String barcode,
        BigDecimal price,
        BigDecimal cost,
        Integer quantity,
        Integer reorderPoint,
        LocalDateTime createdAt) {
}


