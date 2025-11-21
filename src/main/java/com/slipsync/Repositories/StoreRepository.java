package com.slipsync.Repositories;

import com.slipsync.Entities.Store;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StoreRepository extends JpaRepository<Store, UUID> {
    List<Store> findByMerchantId(String merchantId);

    Optional<Store> findFirstByMerchantIdOrderByCreatedAtAsc(String merchantId);
}