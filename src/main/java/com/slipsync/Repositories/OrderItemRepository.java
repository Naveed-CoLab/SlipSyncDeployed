package com.slipsync.Repositories;

import com.slipsync.Entities.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    long countByOrderId(UUID orderId);
}