package com.slipsync.Repositories;

import com.slipsync.Entities.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    List<Customer> findByMerchantId(String merchantId);
    
    List<Customer> findByStoreId(UUID storeId);
    
    @Query("SELECT c FROM Customer c WHERE c.merchant.id = :merchantId AND c.store.id IN :storeIds")
    List<Customer> findByMerchantIdAndStoreIds(@Param("merchantId") String merchantId, @Param("storeIds") List<UUID> storeIds);
}