package com.slipsync.Repositories;

import com.slipsync.Entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByClerkUserId(String clerkUserId);
    
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role WHERE u.clerkUserId = :clerkUserId")
    Optional<User> findByClerkUserIdWithRole(@Param("clerkUserId") String clerkUserId);
    
    long countByMerchantId(String merchantId);
    List<User> findByMerchantId(String merchantId);
    
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role WHERE u.merchant.id = :merchantId")
    List<User> findByMerchantIdWithRole(@Param("merchantId") String merchantId);
}