package com.slipsync.Repositories;

import com.slipsync.Entities.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {
    List<Inventory> findByStoreId(UUID storeId);
    Optional<Inventory> findByStoreIdAndVariantId(UUID storeId, UUID variantId);
}