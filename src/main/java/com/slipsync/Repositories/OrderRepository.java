package com.slipsync.Repositories;

import com.slipsync.Entities.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByStoreIdOrderByPlacedAtDesc(UUID storeId);
    List<Order> findByStoreIdAndPlacedAtBetweenOrderByPlacedAtDesc(UUID storeId, LocalDateTime start, LocalDateTime end);
}