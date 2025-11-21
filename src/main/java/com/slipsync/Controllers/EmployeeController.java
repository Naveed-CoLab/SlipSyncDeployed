package com.slipsync.Controllers;

import com.clerk.backend_api.Clerk;
import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import com.slipsync.Services.PermissionService;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleRepository roleRepository;
    private final PermissionService permissionService;
    private final StoreContextService storeContextService;
    private final Clerk clerkSdk;

    public EmployeeController(UserRepository userRepository,
                             StoreRepository storeRepository,
                             RolePermissionRepository rolePermissionRepository,
                             RoleRepository roleRepository,
                             PermissionService permissionService,
                             StoreContextService storeContextService,
                             Clerk clerkSdk) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.roleRepository = roleRepository;
        this.permissionService = permissionService;
        this.storeContextService = storeContextService;
        this.clerkSdk = clerkSdk;
    }

    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        // Use the query that eagerly fetches the role
        return userRepository.findByClerkUserIdWithRole(clerkId)
                .map(user -> {
                    // Ensure role is loaded (it should be, but let's verify)
                    if (user.getRole() != null) {
                        System.out.println("✅ [EmployeeController] getCurrentUser: User role loaded: " + user.getRole().getName() + " (ID: " + user.getRole().getId() + ")");
                    } else {
                        System.out.println("⚠️  [EmployeeController] getCurrentUser: User role is NULL for user: " + user.getFullName() + " (ID: " + user.getId() + ")");
                    }
                    storeContextService.attachStore(user, request);
                    return user;
                })
                .orElse(null);
    }

    /**
     * Get all employees for the current merchant.
     * Only admins can access this endpoint.
     */
    @GetMapping
    public ResponseEntity<?> getEmployees(HttpServletRequest request) {
        User currentUser = getCurrentUser(request);
        if (currentUser == null) {
            System.out.println("❌ [EmployeeController] getEmployees: No user found");
            return ResponseEntity.status(401).body("Unauthorized");
        }

        System.out.println("🔍 [EmployeeController] getEmployees: User = " + currentUser.getFullName() + 
                ", Role = " + (currentUser.getRole() != null ? currentUser.getRole().getName() : "null") +
                ", Role ID = " + (currentUser.getRole() != null ? currentUser.getRole().getId() : "null"));
        
        // Only admins can manage employees
        boolean isAdmin = permissionService.isAdmin(currentUser);
        System.out.println("🔍 [EmployeeController] getEmployees: isAdmin check result = " + isAdmin);
        
        if (!isAdmin) {
            System.out.println("❌ [EmployeeController] getEmployees: User is not admin - denying access");
            return ResponseEntity.status(403).body("Permission denied: Only admins can view employees");
        }
        
        System.out.println("✅ [EmployeeController] getEmployees: User is admin, proceeding...");

        try {
            // Get all users for this merchant with EMPLOYEE role (with roles eagerly fetched)
            List<User> allUsers = userRepository.findByMerchantIdWithRole(currentUser.getMerchant().getId());
            System.out.println("🔍 [EmployeeController] Total users for merchant: " + allUsers.size());
            
            // Debug: Log role info for each user
            allUsers.forEach(user -> {
                String roleName = user.getRole() != null ? user.getRole().getName() : "null";
                String roleId = user.getRole() != null ? user.getRole().getId().toString() : "null";
                boolean isEmp = permissionService.isEmployee(user);
                boolean isAdm = permissionService.isAdmin(user);
                System.out.println("🔍 [EmployeeController] User: " + user.getFullName() + 
                        " (ID: " + user.getId() + "), Role: " + roleName + 
                        " (Role ID: " + roleId + "), isEmployee=" + isEmp + ", isAdmin=" + isAdm);
            });
            
            List<User> employees = allUsers.stream()
                    .filter(user -> {
                        boolean isEmp = permissionService.isEmployee(user);
                        if (!isEmp && user.getRole() != null) {
                            System.out.println("🔍 [EmployeeController] User " + user.getFullName() + 
                                    " has role '" + user.getRole().getName() + "' but is not recognized as employee");
                        }
                        return isEmp;
                    })
                    .collect(Collectors.toList());
            System.out.println("✅ [EmployeeController] Found " + employees.size() + " employees out of " + allUsers.size() + " total users");

            // Build response with employee info and their store access
            List<Map<String, Object>> employeeList = employees.stream().map(employee -> {
                List<UUID> storeIds = List.of();
                try {
                    storeIds = rolePermissionRepository.findStoreIdsByUserId(employee.getId());
                } catch (Exception e) {
                    // Table might not exist yet - return empty list
                    System.out.println("⚠️  Warning: Could not fetch store permissions for employee: " + e.getMessage());
                }
                
                Map<String, Object> emp = new HashMap<>();
                emp.put("id", employee.getId().toString());
                emp.put("clerkUserId", employee.getClerkUserId());
                emp.put("email", employee.getEmail());
                // Clean up fullName - remove "Optional" text if present
                String fullName = employee.getFullName();
                if (fullName != null) {
                    fullName = fullName.replace("Optional[", "").replace("]", "").trim();
                    if (fullName.isEmpty()) {
                        fullName = null;
                    }
                }
                emp.put("fullName", fullName != null ? fullName : employee.getEmail());
                emp.put("roleId", employee.getRole() != null ? employee.getRole().getId().toString() : null);
                emp.put("roleName", employee.getRole() != null ? employee.getRole().getName() : null);
                // Convert UUIDs to strings for frontend
                List<String> storeAccessStrings = storeIds.stream()
                        .map(UUID::toString)
                        .collect(Collectors.toList());
                emp.put("storeAccess", storeAccessStrings);
                emp.put("createdAt", employee.getCreatedAt());
                
                return emp;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(employeeList);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error fetching employees: " + e.getMessage());
        }
    }

    /**
     * Get all stores for the current merchant (for the store selection UI).
     */
    @GetMapping("/stores")
    public ResponseEntity<?> getStoresForSelection(HttpServletRequest request) {
        User currentUser = getCurrentUser(request);
        if (currentUser == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        if (!permissionService.isAdmin(currentUser)) {
            return ResponseEntity.status(403).body("Permission denied: Only admins can view stores");
        }

        List<Store> stores = storeRepository.findByMerchantId(currentUser.getMerchant().getId());
        List<Map<String, Object>> storeList = stores.stream().map(store -> {
            Map<String, Object> storeMap = new HashMap<>();
            storeMap.put("id", store.getId());
            storeMap.put("name", store.getName());
            storeMap.put("address", store.getAddress());
            storeMap.put("currency", store.getCurrency());
            return storeMap;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(storeList);
    }

    /**
     * Update store access for an employee.
     * Request body: { "userId": "...", "storeIds": ["uuid1", "uuid2", ...] }
     */
    @PutMapping("/{userId}/store-access")
    @Transactional
    public ResponseEntity<?> updateStoreAccess(HttpServletRequest request,
                                               @PathVariable UUID userId,
                                               @RequestBody Map<String, Object> payload) {
        User currentUser = getCurrentUser(request);
        if (currentUser == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        if (!permissionService.isAdmin(currentUser)) {
            return ResponseEntity.status(403).body("Permission denied: Only admins can update store access");
        }

        try {
            // Verify the target user belongs to the same merchant
            User targetUser = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (!targetUser.getMerchant().getId().equals(currentUser.getMerchant().getId())) {
                return ResponseEntity.status(403).body("Cannot manage users from different merchants");
            }

            // Verify target user is an employee
            if (!permissionService.isEmployee(targetUser)) {
                return ResponseEntity.status(400).body("Can only manage store access for employees");
            }

            // Get store IDs from payload
            @SuppressWarnings("unchecked")
            List<String> storeIdStrings = (List<String>) payload.get("storeIds");
            if (storeIdStrings == null) {
                storeIdStrings = List.of();
            }

            try {
                // Delete existing permissions for this user
                rolePermissionRepository.deleteByUserId(userId);
            } catch (Exception e) {
                // Table might not exist yet - that's okay, we'll create new entries
                System.out.println("⚠️  Warning: Could not delete existing permissions: " + e.getMessage());
            }

            // Create new permissions
            List<Store> allStores = storeRepository.findByMerchantId(currentUser.getMerchant().getId());
            Set<UUID> validStoreIds = allStores.stream()
                    .map(Store::getId)
                    .collect(Collectors.toSet());

            for (String storeIdStr : storeIdStrings) {
                try {
                    UUID storeId = UUID.fromString(storeIdStr);
                    if (validStoreIds.contains(storeId)) {
                        Store store = storeRepository.findById(storeId)
                                .orElseThrow(() -> new RuntimeException("Store not found: " + storeId));

                        RolePermission permission = new RolePermission();
                        permission.setUser(targetUser);
                        permission.setStore(store);
                        rolePermissionRepository.save(permission);
                    }
                } catch (IllegalArgumentException e) {
                    // Skip invalid UUIDs
                    continue;
                } catch (Exception e) {
                    // Table might not exist - log and continue
                    System.out.println("⚠️  Warning: Could not save permission: " + e.getMessage());
                    return ResponseEntity.status(500).body("Database table 'role_permissions' does not exist. Please create it first.");
                }
            }

            // Return updated employee info
            List<UUID> updatedStoreIds = List.of();
            try {
                updatedStoreIds = rolePermissionRepository.findStoreIdsByUserId(userId);
            } catch (Exception e) {
                System.out.println("⚠️  Warning: Could not fetch updated permissions: " + e.getMessage());
            }
            Map<String, Object> response = new HashMap<>();
            response.put("userId", userId);
            response.put("storeAccess", updatedStoreIds);
            response.put("message", "Store access updated successfully");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error updating store access: " + e.getMessage());
        }
    }
}

