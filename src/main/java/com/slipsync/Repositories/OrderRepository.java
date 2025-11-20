package com.slipsync.Repositories;

import com.slipsync.Entities.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByStoreIdOrderByPlacedAtDesc(UUID storeId);
}