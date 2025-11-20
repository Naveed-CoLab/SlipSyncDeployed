package com.slipsync.Controllers;

import com.clerk.backend_api.Clerk;
import com.slipsync.Entities.Merchant;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.MerchantRepository;
import com.slipsync.Repositories.StoreRepository;
import com.slipsync.Repositories.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final StoreRepository storeRepository;
    private final Clerk clerkSdk;

    public AuthController(UserRepository userRepository, 
                          MerchantRepository merchantRepository, 
                          StoreRepository storeRepository,
                          Clerk clerkSdk) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.storeRepository = storeRepository;
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

        // 2. Check if user already exists in our DB
        Optional<User> existingUser = userRepository.findByClerkUserId(clerkId);
        if (existingUser.isPresent()) {
            // User exists, return their info
            return ResponseEntity.ok(buildUserResponse(existingUser.get()));
        }

        // 3. User is NEW. We need to onboard them.
        try {
            // A. Fetch details from Clerk to get email/name
            var clerkUserResponse = clerkSdk.users().get().userId(clerkId).call();
            var clerkUser = clerkUserResponse.user().get();
            
            String email = "no-email";
            if (clerkUser.emailAddresses() != null && !clerkUser.emailAddresses().isEmpty()) {
                email = clerkUser.emailAddresses().get(0).emailAddress();
            }
            String name = (clerkUser.firstName() != null ? clerkUser.firstName() : "") + 
                          (clerkUser.lastName() != null ? " " + clerkUser.lastName() : "");
            name = name.trim();
            if (name.isEmpty()) name = "New Merchant";

            // B. Create Merchant (Organization)
            Merchant newMerchant = new Merchant();
            newMerchant.setName(name + "'s Business"); // Default name
            newMerchant = merchantRepository.save(newMerchant);

            // C. Create Default Store (Branch)
            Store newStore = new Store();
            newStore.setName("Main Branch");
            newStore.setMerchant(newMerchant);
            newStore = storeRepository.save(newStore);

            // D. Create User (Linked to Merchant & Store)
            User newUser = new User();
            newUser.setClerkUserId(clerkId);
            newUser.setEmail(email);
            newUser.setFullName(name);
            newUser.setMerchant(newMerchant);
            newUser.setStore(newStore);
            newUser = userRepository.save(newUser);

            return ResponseEntity.ok(buildUserResponse(newUser));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error syncing user: " + e.getMessage());
        }
    }

    // Helper to make a clean JSON response
    private Map<String, Object> buildUserResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("clerkUserId", user.getClerkUserId());
        response.put("email", user.getEmail());
        response.put("merchantId", user.getMerchant().getId());
        response.put("storeId", user.getStore().getId());
        return response;
    }
}