package com.slipsync.Repositories;

import com.slipsync.DTO.ProductInventoryDto;
import com.slipsync.Entities.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {
    List<ProductVariant> findByProductId(UUID productId);

    @Query("""
        select new com.slipsync.DTO.ProductInventoryDto(
            inv.id,
            prod.id,
            variant.id,
            prod.name,
            variant.sku,
            variant.barcode,
            variant.price,
            variant.cost,
            coalesce(inv.quantity, 0),
            coalesce(inv.reorderPoint, 0),
            prod.createdAt
        )
        from ProductVariant variant
        join variant.product prod
        left join Inventory inv on inv.variant = variant and inv.store.id = :storeId
        where prod.merchant.id = :merchantId
          and (prod.store is null or prod.store.id = :storeId)
        order by prod.createdAt desc
    """)
    List<ProductInventoryDto> findInventoryOverview(
            @Param("merchantId") String merchantId,
            @Param("storeId") UUID storeId);
}