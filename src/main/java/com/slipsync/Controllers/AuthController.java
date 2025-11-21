package com.slipsync.Controllers;

import com.clerk.backend_api.Clerk;
import com.slipsync.Entities.Merchant;
import com.slipsync.Entities.Role;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.MerchantRepository;
import com.slipsync.Repositories.RoleRepository;
import com.slipsync.Repositories.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final RoleRepository roleRepository;
    private final Clerk clerkSdk;

    public AuthController(UserRepository userRepository,
                          MerchantRepository merchantRepository,
                          RoleRepository roleRepository,
                          Clerk clerkSdk) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.roleRepository = roleRepository;
        this.clerkSdk = clerkSdk;
    }

    @PostMapping("/sync")
    @Transactional // Ensures all DB saves happen together or not at all
    public ResponseEntity<?> syncUser(HttpServletRequest request) {
        // 1. Get Clerk ID from the Token (put there by ClerkAuthFilter)
        String clerkId = (String) request.getAttribute("clerk.userId");
        if (clerkId == null) {
            return ResponseEntity.status(401).body("Unauthorized: No User ID found");
        }

        // Optional: active Clerk organization id (sent by frontend). When present,
        // we will use it as the Merchant primary key.
        String clerkOrgId = request.getHeader("X-Clerk-Org-Id");

        // 2. Check if user already exists in our DB (with role eagerly fetched)
        Optional<User> existingUserOpt = userRepository.findByClerkUserIdWithRole(clerkId);
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            
            // Try to get role from header first
            Role incomingRole = determineRoleFromHeaders(request, existingUser.getMerchant(), false);
            
            // If no role from header, use existing role from database
            if (incomingRole == null && existingUser.getRole() != null) {
                System.out.println("✅ [AuthController] Using existing role from database: " + existingUser.getRole().getName());
                incomingRole = existingUser.getRole();
            }
            
            // If still no role, try fallback logic (for users created before role system)
            if (incomingRole == null) {
                System.out.println("⚠️  [AuthController] No role found, using fallback logic");
                incomingRole = determineRoleFromHeaders(request, existingUser.getMerchant(), true);
            }
            
            // Update role if it changed or was missing
            if (incomingRole != null && (existingUser.getRole() == null ||
                    !incomingRole.getId().equals(existingUser.getRole().getId()))) {
                System.out.println("🔄 [AuthController] Updating user role from " + 
                        (existingUser.getRole() != null ? existingUser.getRole().getName() : "null") + 
                        " to " + incomingRole.getName());
                existingUser.setRole(incomingRole);
                existingUser = userRepository.save(existingUser);
            } else if (existingUser.getRole() != null) {
                System.out.println("✅ [AuthController] User role unchanged: " + existingUser.getRole().getName());
            }
            
            return ResponseEntity.ok(buildUserResponse(existingUser));
        }

        // 3. User is NEW. We need to onboard them (but DO NOT create a Store automatically).
        try {
            // A. Fetch details from Clerk to get email/name
            var clerkUserResponse = clerkSdk.users().get().userId(clerkId).call();
            var clerkUser = clerkUserResponse.user().get();
            
            String email = "no-email";
            if (clerkUser.emailAddresses() != null && !clerkUser.emailAddresses().isEmpty()) {
                email = clerkUser.emailAddresses().get(0).emailAddress();
            }
            String rawName = (clerkUser.firstName() != null ? clerkUser.firstName() : "") +
                             (clerkUser.lastName() != null ? " " + clerkUser.lastName() : "");
            rawName = rawName.trim();
            final String merchantName = rawName.isEmpty() ? "New Merchant" : rawName;

            // B. Resolve or create Merchant. If we have a Clerk org id, that becomes the PK.
            Merchant merchant;
            if (clerkOrgId != null && !clerkOrgId.isBlank()) {
                merchant = merchantRepository.findById(clerkOrgId)
                        .orElseGet(() -> {
                            Merchant m = new Merchant();
                            m.setId(clerkOrgId);
                            m.setName(merchantName + "'s Business");
                            return merchantRepository.save(m);
                        });
            } else {
                merchant = new Merchant();
                // fall back to a random UUID string if no organization is present
                merchant.setId(UUID.randomUUID().toString());
                merchant.setName(merchantName + "'s Business");
                merchant = merchantRepository.save(merchant);
            }

            // C. Create User (linked only to Merchant for now)
            User newUser = new User();
            newUser.setClerkUserId(clerkId);
            newUser.setEmail(email);
            newUser.setFullName(merchantName);
            newUser.setMerchant(merchant);
            Role assignedRole = determineRoleFromHeaders(request, merchant, true);
            newUser.setRole(assignedRole);
            newUser = userRepository.save(newUser);

            return ResponseEntity.ok(buildUserResponse(newUser));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error syncing user: " + e.getMessage());
        }
    }

    // Helper to make a clean JSON response
    /**
     * Get current user's role from database.
     * This endpoint returns the role stored in the database (users.role_id).
     */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        if (clerkId == null) {
            return ResponseEntity.status(401).body("Unauthorized: No User ID found");
        }

        Optional<User> userOpt = userRepository.findByClerkUserIdWithRole(clerkId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found. Please sync your account first.");
        }

        User user = userOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("clerkUserId", user.getClerkUserId());
        response.put("email", user.getEmail());
        response.put("merchantId", user.getMerchant().getId());
        response.put("roleId", user.getRole() != null ? user.getRole().getId() : null);
        response.put("roleName", user.getRole() != null ? user.getRole().getName() : null);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildUserResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("clerkUserId", user.getClerkUserId());
        response.put("email", user.getEmail());
        response.put("merchantId", user.getMerchant().getId());
        response.put("roleId", user.getRole() != null ? user.getRole().getId() : null);
        response.put("roleName", user.getRole() != null ? user.getRole().getName() : null);
        return response;
    }

    private Role determineRoleFromHeaders(HttpServletRequest request, Merchant merchant, boolean fallbackToDefault) {
        String clerkRole = request.getHeader("X-Clerk-Org-Role");
        String normalized = normalizeRole(clerkRole);
        if (normalized == null && fallbackToDefault) {
            long usersForMerchant = userRepository.countByMerchantId(merchant.getId());
            normalized = usersForMerchant == 0 ? "ADMIN" : "EMPLOYEE";
            System.out.println("🔍 [AuthController] No role header provided. Users for merchant: " + usersForMerchant + ", assigning: " + normalized);
        } else if (normalized != null) {
            System.out.println("🔍 [AuthController] Role from header: " + clerkRole + " -> normalized: " + normalized);
        }
        if (normalized == null) {
            System.out.println("⚠️  [AuthController] Could not determine role - returning null");
            return null;
        }
        final String roleName = normalized.toUpperCase(Locale.ROOT);
        Role role = roleRepository.findByNameIgnoreCase(roleName)
                .orElseGet(() -> {
                    System.out.println("✅ [AuthController] Creating new role: " + roleName);
                    Role newRole = new Role();
                    newRole.setName(roleName);
                    newRole.setDescription("Auto-provisioned from Clerk role");
                    return roleRepository.save(newRole);
                });
        System.out.println("✅ [AuthController] Assigned role: " + role.getName() + " (ID: " + role.getId() + ")");
        return role;
    }

    private String normalizeRole(String clerkRole) {
        if (clerkRole == null || clerkRole.isBlank()) {
            return null;
        }
        return switch (clerkRole.toLowerCase(Locale.ROOT)) {
            case "org:admin", "admin", "owner" -> "ADMIN";
            case "org:employee", "employee", "staff" -> "EMPLOYEE";
            default -> null;
        };
    }
}