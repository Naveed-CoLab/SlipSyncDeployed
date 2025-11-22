package com.slipsync.Controllers;

import com.slipsync.Entities.Supplier;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.SupplierRepository;
import com.slipsync.Repositories.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ContactController {

    private final SupplierRepository supplierRepository;
    private final UserRepository userRepository;

    public ContactController(SupplierRepository supplierRepository,
                             UserRepository userRepository) {
        this.supplierRepository = supplierRepository;
        this.userRepository = userRepository;
    }

    // Helper to get current user
    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId).orElse(null);
    }

    // --- SUPPLIERS ---

    @GetMapping("/suppliers")
    public ResponseEntity<?> getSuppliers(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Supplier> suppliers = supplierRepository.findByMerchantId(user.getMerchant().getId());
        return ResponseEntity.ok(suppliers);
    }

    @PostMapping("/suppliers")
    public ResponseEntity<?> createSupplier(HttpServletRequest request, @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Supplier supplier = new Supplier();
        supplier.setName(payload.get("name"));
        supplier.setAddress(payload.get("address"));
        supplier.setMerchant(user.getMerchant());
        // 'contact' field logic can be added here if payload contains it

        return ResponseEntity.ok(supplierRepository.save(supplier));
    }
}