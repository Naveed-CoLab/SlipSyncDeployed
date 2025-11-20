package com.slipsync.Controllers;

import com.clerk.backend_api.Clerk;
import com.clerk.backend_api.models.components.User; // Correct import
import com.clerk.backend_api.models.components.EmailAddress; // <-- IMPORT THIS
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap; // Import HashMap
import java.util.Map;     // Import Map

@RestController
@RequestMapping("/api/me")
public class UserController {

    private final Clerk clerkSdk;

    public UserController(Clerk clerkSdk) {
        this.clerkSdk = clerkSdk;
    }

    @GetMapping
    public ResponseEntity<?> me(HttpServletRequest request) {
        String userId = (String) request.getAttribute("clerk.userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        try {
            var res = clerkSdk.users().get()
                    .userId(userId)
                    .call();

            if (res.user().isPresent()) {
                // 1. Get the complex User object
                User user = res.user().get();
                
                // 2. Create a simple Map to hold the data
                Map<String, Object> userMap = new HashMap<>();
                
                // 3. Copy only the simple fields you need
                userMap.put("id", user.id()); 
                userMap.put("firstName", user.firstName()); 
                userMap.put("lastName", user.lastName()); 
                userMap.put("publicMetadata", user.publicMetadata());

                // --- THIS IS THE NEW FIX ---
                // The emailAddresses() list is complex. Let's just get the first email as a simple string.
                if (user.emailAddresses() != null && !user.emailAddresses().isEmpty()) {
                    // Get the first EmailAddress object
                    EmailAddress firstEmail = user.emailAddresses().get(0);
                    // Get the actual email string from that object
                    userMap.put("firstEmail", firstEmail.emailAddress());
                } else {
                    userMap.put("firstEmail", "No email found");
                }
                // --- END OF NEW FIX ---

                // 4. Return the simple Map. Spring Boot CAN serialize this.
                return ResponseEntity.ok(userMap);
            } else {
                return ResponseEntity.status(404).body("User not found in Clerk");
            }
        } catch (Exception e) {
            // Print the stack trace to see the real serialization error
            e.printStackTrace(); 
            return ResponseEntity.status(500).body("Clerk API error: " + e.getMessage());
        }
    }
}