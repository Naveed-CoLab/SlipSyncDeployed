package com.slipsync.Repositories;

import com.slipsync.Entities.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    List<Customer> findByMerchantId(String merchantId);
}