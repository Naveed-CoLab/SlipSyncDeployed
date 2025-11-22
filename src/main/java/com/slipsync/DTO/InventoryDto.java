package com.slipsync.DTO;

import java.time.LocalDateTime;
import java.util.UUID;

public record InventoryDto(
        UUID id,
        UUID storeId,
        UUID productVariantId,
        UUID productId,
        String productName,
        String variantSku,
        Integer quantity,
        Integer reserved,
        Integer reorderPoint,
        LocalDateTime updatedAt) {
}

