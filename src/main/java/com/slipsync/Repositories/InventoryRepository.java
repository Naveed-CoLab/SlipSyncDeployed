package com.slipsync.Repositories;

import com.slipsync.Entities.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {
    List<Inventory> findByStoreId(UUID storeId);
    Optional<Inventory> findByStoreIdAndVariantId(UUID storeId, UUID variantId);
    
    @Query("SELECT inv FROM Inventory inv " +
           "JOIN FETCH inv.variant variant " +
           "JOIN FETCH variant.product product " +
           "WHERE inv.store.id = :storeId")
    List<Inventory> findByStoreIdWithVariantAndProduct(@Param("storeId") UUID storeId);
}