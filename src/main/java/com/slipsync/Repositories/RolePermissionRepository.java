package com.slipsync.Repositories;

import com.slipsync.Entities.RolePermission;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {
    
    /**
     * Find all store permissions for a specific user.
     */
    List<RolePermission> findByUserId(UUID userId);
    
    /**
     * Find all users who have access to a specific store.
     */
    List<RolePermission> findByStoreId(UUID storeId);
    
    /**
     * Check if a user has access to a specific store.
     */
    boolean existsByUserIdAndStoreId(UUID userId, UUID storeId);
    
    /**
     * Delete all permissions for a user (when updating their store access).
     */
    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.user.id = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
    
    /**
     * Delete a specific permission.
     */
    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.user.id = :userId AND rp.store.id = :storeId")
    void deleteByUserIdAndStoreId(@Param("userId") UUID userId, @Param("storeId") UUID storeId);
    
    /**
     * Get all store IDs a user has access to.
     */
    @Query("SELECT rp.store.id FROM RolePermission rp WHERE rp.user.id = :userId")
    List<UUID> findStoreIdsByUserId(@Param("userId") UUID userId);
}

