package com.slipsync.Services;

import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.RolePermissionRepository;
import com.slipsync.Repositories.StoreRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StoreContextService {

    private static final String STORE_HEADER = "X-Store-Id";
    private static final String STORE_ACCESS_HEADER = "X-Clerk-Store-Access";
    private final StoreRepository storeRepository;
    private final PermissionService permissionService;
    private final RolePermissionRepository rolePermissionRepository;

    public StoreContextService(StoreRepository storeRepository, 
                              PermissionService permissionService,
                              RolePermissionRepository rolePermissionRepository) {
        this.storeRepository = storeRepository;
        this.permissionService = permissionService;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    /**
     * Resolves and attaches an active Store to the provided User based on the incoming request.
     * Order of precedence:
     * 1. X-Store-Id header (must belong to the same merchant AND user must have access)
     * 2. First accessible store owned by the merchant (based on creation time)
     */
    public Store attachStore(User user, HttpServletRequest request) {
        if (user == null) {
            return null;
        }

        Set<String> storeAccess = getStoreAccess(request, user);
        Store activeStore = resolveFromHeader(user, request, storeAccess);
        if (activeStore == null) {
            // Find first accessible store
            activeStore = storeRepository.findFirstByMerchantIdOrderByCreatedAtAsc(user.getMerchant().getId())
                    .filter(store -> permissionService.canAccessStore(user, store.getId(), storeAccess))
                    .orElse(null);
        }

        user.setStore(activeStore);
        if (activeStore == null) {
            System.out.println("⚠️  [StoreContextService] No store attached for user. Merchant ID: " + 
                    (user.getMerchant() != null ? user.getMerchant().getId() : "null") + 
                    ", Store access: " + storeAccess.size() + " stores");
        } else {
            System.out.println("✅ [StoreContextService] Attached store: " + activeStore.getName() + " (ID: " + activeStore.getId() + ")");
        }
        return activeStore;
    }

    private Store resolveFromHeader(User user, HttpServletRequest request, Set<String> storeAccess) {
        String header = request.getHeader(STORE_HEADER);
        if (header == null || header.isBlank()) {
            return null;
        }

        try {
            UUID storeId = UUID.fromString(header.trim());
            return storeRepository.findById(storeId)
                    .filter(store -> Objects.equals(store.getMerchant().getId(), user.getMerchant().getId()))
                    .filter(store -> permissionService.canAccessStore(user, store.getId(), storeAccess))
                    .orElse(null);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    /**
     * Parse store_access from X-Clerk-Store-Access header (comma-separated store IDs).
     */
    private Set<String> parseStoreAccess(HttpServletRequest request) {
        String header = request.getHeader(STORE_ACCESS_HEADER);
        if (header == null || header.isBlank()) {
            return Set.of();
        }
        return Set.of(header.split(","))
                .stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Get store access set from request header.
     * Falls back to database if header is not present (for employees).
     */
    public Set<String> getStoreAccess(HttpServletRequest request, User user) {
        Set<String> headerAccess = parseStoreAccess(request);
        if (!headerAccess.isEmpty()) {
            return headerAccess;
        }
        
        // If no header, check database for employee permissions
        if (user != null && permissionService.isEmployee(user)) {
            try {
                List<UUID> storeIds = rolePermissionRepository.findStoreIdsByUserId(user.getId());
                return storeIds.stream()
                        .map(UUID::toString)
                        .collect(Collectors.toSet());
            } catch (Exception e) {
                // Table might not exist yet - return empty set
                System.out.println("⚠️  Warning: Could not fetch store permissions from database: " + e.getMessage());
                return Set.of();
            }
        }
        
        return Set.of();
    }
}

