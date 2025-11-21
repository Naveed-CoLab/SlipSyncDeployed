package com.slipsync.Services;

import com.slipsync.Entities.Role;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service to check user permissions based on role and store access.
 * - ADMIN: Full access to all stores
 * - EMPLOYEE: Access only to stores in their store_access list
 */
@Service
public class PermissionService {

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String EMPLOYEE_ROLE = "EMPLOYEE";
    // Also support Clerk's original role names as fallback
    private static final String CLERK_ADMIN_ROLE = "org:admin";
    private static final String CLERK_EMPLOYEE_ROLE = "org:employee";

    /**
     * Check if user has access to a specific store.
     * @param user The user making the request
     * @param storeId The store ID to check access for
     * @param storeAccess Set of store IDs the user has access to (from Clerk metadata)
     * @return true if user can access the store
     */
    public boolean canAccessStore(User user, UUID storeId, Set<String> storeAccess) {
        if (user == null || storeId == null) {
            return false;
        }

        Role role = user.getRole();
        if (role == null) {
            return false;
        }

        String roleName = role.getName();
        // Check both normalized names (ADMIN/EMPLOYEE) and Clerk names (org:admin/org:employee)
        boolean isAdmin = ADMIN_ROLE.equalsIgnoreCase(roleName) || CLERK_ADMIN_ROLE.equalsIgnoreCase(roleName);
        boolean isEmployee = EMPLOYEE_ROLE.equalsIgnoreCase(roleName) || CLERK_EMPLOYEE_ROLE.equalsIgnoreCase(roleName);
        
        if (isAdmin) {
            // Admin has access to all stores
            return true;
        }

        if (isEmployee) {
            // Employee can only access stores in their store_access list
            return storeAccess != null && storeAccess.contains(storeId.toString());
        }

        return false;
    }

    /**
     * Check if user has a specific permission.
     * @param user The user making the request
     * @param permission The permission to check (e.g., "manage_products", "process_sales")
     * @return true if user has the permission
     */
    public boolean hasPermission(User user, String permission) {
        if (user == null || permission == null) {
            return false;
        }

        Role role = user.getRole();
        if (role == null) {
            return false;
        }

        String roleName = role.getName();
        // Check both normalized names (ADMIN/EMPLOYEE) and Clerk names (org:admin/org:employee)
        boolean isAdmin = ADMIN_ROLE.equalsIgnoreCase(roleName) || CLERK_ADMIN_ROLE.equalsIgnoreCase(roleName);
        boolean isEmployee = EMPLOYEE_ROLE.equalsIgnoreCase(roleName) || CLERK_EMPLOYEE_ROLE.equalsIgnoreCase(roleName);
        
        if (isAdmin) {
            // Admin has all permissions
            return true;
        }

        if (isEmployee) {
            // Employee permissions based on role
            return switch (permission.toLowerCase()) {
                case "process_sales", "view_inventory", "update_inventory",
                     "manage_customers", "view_reports" -> true;
                case "manage_stores", "manage_employees", "manage_products",
                     "export_reports", "refund_sales" -> false;
                default -> false;
            };
        }

        return false;
    }

    /**
     * Filter stores based on user's access.
     * @param user The user making the request
     * @param allStores All stores for the merchant
     * @param storeAccess Set of store IDs the user has access to (from Clerk metadata)
     * @return Filtered list of stores the user can access
     */
    public List<Store> filterAccessibleStores(User user, List<Store> allStores, Set<String> storeAccess) {
        if (user == null || allStores == null) {
            System.out.println("⚠️  [PermissionService] filterAccessibleStores: user or allStores is null");
            return List.of();
        }

        Role role = user.getRole();
        String roleName = role != null ? role.getName() : null;
        
        // If role is null, log warning but don't fail - might be a legacy user
        if (roleName == null) {
            System.out.println("⚠️  [PermissionService] filterAccessibleStores: user role is null - treating as admin for backward compatibility");
            // For backward compatibility, if user has no role but has stores, treat as admin
            return allStores;
        }

        System.out.println("🔍 [PermissionService] Filtering stores for role: '" + roleName + "' (ADMIN_ROLE='" + ADMIN_ROLE + "', CLERK_ADMIN='" + CLERK_ADMIN_ROLE + "')");
        
        // Check both normalized names (ADMIN/EMPLOYEE) and Clerk names (org:admin/org:employee)
        boolean isAdmin = ADMIN_ROLE.equalsIgnoreCase(roleName) || CLERK_ADMIN_ROLE.equalsIgnoreCase(roleName);
        boolean isEmployee = EMPLOYEE_ROLE.equalsIgnoreCase(roleName) || CLERK_EMPLOYEE_ROLE.equalsIgnoreCase(roleName);
        
        System.out.println("🔍 [PermissionService] isAdmin=" + isAdmin + ", isEmployee=" + isEmployee);
        
        if (isAdmin) {
            // Admin can see all stores
            System.out.println("✅ [PermissionService] Admin user - returning all " + allStores.size() + " stores");
            return allStores;
        }

        if (isEmployee) {
            // Employee can only see stores in their store_access list
            if (storeAccess == null || storeAccess.isEmpty()) {
                System.out.println("⚠️  [PermissionService] Employee has no store access - returning empty list");
                return List.of();
            }
            List<Store> filtered = allStores.stream()
                    .filter(store -> storeAccess.contains(store.getId().toString()))
                    .toList();
            System.out.println("✅ [PermissionService] Employee - returning " + filtered.size() + " accessible stores");
            return filtered;
        }

        System.out.println("⚠️  [PermissionService] Unknown role: '" + roleName + "' - returning all stores as fallback");
        // Fallback: if role doesn't match, return all stores (safer than returning empty)
        return allStores;
    }

    /**
     * Check if user is admin.
     */
    public boolean isAdmin(User user) {
        if (user == null) {
            System.out.println("⚠️  [PermissionService] isAdmin: user is null");
            return false;
        }
        if (user.getRole() == null) {
            System.out.println("⚠️  [PermissionService] isAdmin: user role is null for user: " + user.getFullName());
            return false;
        }
        String roleName = user.getRole().getName();
        boolean isAdmin = ADMIN_ROLE.equalsIgnoreCase(roleName) || CLERK_ADMIN_ROLE.equalsIgnoreCase(roleName);
        System.out.println("🔍 [PermissionService] isAdmin check: roleName='" + roleName + "', ADMIN_ROLE='" + ADMIN_ROLE + "', CLERK_ADMIN='" + CLERK_ADMIN_ROLE + "', result=" + isAdmin);
        return isAdmin;
    }

    /**
     * Check if user is employee.
     */
    public boolean isEmployee(User user) {
        if (user == null || user.getRole() == null) {
            return false;
        }
        String roleName = user.getRole().getName();
        return EMPLOYEE_ROLE.equalsIgnoreCase(roleName) || CLERK_EMPLOYEE_ROLE.equalsIgnoreCase(roleName);
    }
}

