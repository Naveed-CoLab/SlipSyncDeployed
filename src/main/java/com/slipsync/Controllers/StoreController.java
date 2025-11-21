package com.slipsync.Controllers;

import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.StoreRepository;
import com.slipsync.Repositories.UserRepository;
import com.slipsync.Services.PermissionService;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class StoreController {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final StoreContextService storeContextService;

    public StoreController(StoreRepository storeRepository, 
                          UserRepository userRepository,
                          PermissionService permissionService,
                          StoreContextService storeContextService) {
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.storeContextService = storeContextService;
    }

    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId).orElse(null);
    }

    @GetMapping("/stores")
    public ResponseEntity<?> listStores(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Store> allStores = storeRepository.findByMerchantId(user.getMerchant().getId());
        Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
        
        // Debug logging
        String roleName = user.getRole() != null ? user.getRole().getName() : "NULL";
        System.out.println("🔍 [StoreController] User role: " + roleName);
        System.out.println("🔍 [StoreController] Total stores for merchant: " + allStores.size());
        System.out.println("🔍 [StoreController] Store access set size: " + (storeAccess != null ? storeAccess.size() : 0));
        
        // Filter stores based on user's role and store_access
        List<Store> accessibleStores = permissionService.filterAccessibleStores(user, allStores, storeAccess);
        
        System.out.println("🔍 [StoreController] Accessible stores after filtering: " + accessibleStores.size());

        return ResponseEntity.ok(accessibleStores);
    }

    @PostMapping("/stores")
    @Transactional
    public ResponseEntity<?> createStore(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        // Only admins can create stores
        if (!permissionService.hasPermission(user, "manage_stores")) {
            return ResponseEntity.status(403).body("Permission denied: Only admins can create stores");
        }

        if (user.getMerchant() == null) {
            return ResponseEntity.status(400).body("User is not linked to a merchant");
        }

        try {
            Store store = new Store();
            store.setName((String) payload.get("name"));
            store.setAddress((String) payload.get("address"));
            store.setPhone((String) payload.get("phone"));
            store.setTimezone((String) payload.get("timezone"));

            String currency = (String) payload.getOrDefault("currency", "PKR");
            if (currency != null && !currency.isBlank()) {
                store.setCurrency(currency);
            }

            store.setMerchant(user.getMerchant());

            Store saved = storeRepository.save(store);

            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("merchantId", saved.getMerchant().getId());
            response.put("name", saved.getName());
            response.put("currency", saved.getCurrency());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error creating store: " + e.getMessage());
        }
    }
}


