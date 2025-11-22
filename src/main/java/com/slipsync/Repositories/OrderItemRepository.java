package com.slipsync.Repositories;

import com.slipsync.Entities.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    long countByOrderId(UUID orderId);
    
    @Query("SELECT COUNT(oi) FROM OrderItem oi WHERE oi.variant.id = :variantId")
    long countByVariantId(@Param("variantId") UUID variantId);
    
    @Query("SELECT COUNT(oi) FROM OrderItem oi WHERE oi.variant.product.id = :productId")
    long countByProductId(@Param("productId") UUID productId);
    
    @Query("SELECT oi FROM OrderItem oi WHERE oi.variant.id = :variantId")
    List<OrderItem> findByVariantId(@Param("variantId") UUID variantId);
    
    @Query("SELECT oi FROM OrderItem oi " +
           "JOIN FETCH oi.variant variant " +
           "JOIN FETCH variant.product product " +
           "WHERE oi.order.id = :orderId")
    List<OrderItem> findByOrderIdWithVariantAndProduct(@Param("orderId") UUID orderId);
}