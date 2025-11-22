package com.slipsync.Controllers;

import com.slipsync.Entities.Customer;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.CustomerRepository;
import com.slipsync.Repositories.StoreRepository;
import com.slipsync.Repositories.UserRepository;
import com.slipsync.Services.PermissionService;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class CustomerController {

    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PermissionService permissionService;
    private final StoreContextService storeContextService;

    public CustomerController(CustomerRepository customerRepository,
                             UserRepository userRepository,
                             StoreRepository storeRepository,
                             PermissionService permissionService,
                             StoreContextService storeContextService) {
        this.customerRepository = customerRepository;
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.permissionService = permissionService;
        this.storeContextService = storeContextService;
    }

    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId)
                .map(user -> {
                    storeContextService.attachStore(user, request);
                    return user;
                })
                .orElse(null);
    }

    private boolean isAdmin(User user) {
        return permissionService.isAdmin(user);
    }

    private boolean isEmployee(User user) {
        return permissionService.isEmployee(user);
    }

    @GetMapping("/customers")
    public ResponseEntity<?> getCustomers(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Customer> customers;
        
        if (isAdmin(user)) {
            // Admin can view all customers for the merchant
            customers = customerRepository.findByMerchantId(user.getMerchant().getId());
        } else if (isEmployee(user)) {
            // Employee can only view customers for stores in their store_access
            Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
            if (storeAccess == null || storeAccess.isEmpty()) {
                customers = Collections.emptyList();
            } else {
                List<UUID> storeIds = storeAccess.stream()
                        .map(UUID::fromString)
                        .toList();
                customers = customerRepository.findByMerchantIdAndStoreIds(user.getMerchant().getId(), storeIds);
            }
        } else {
            return ResponseEntity.status(403).body("Forbidden: insufficient permissions");
        }

        return ResponseEntity.ok(customers);
    }

    @GetMapping("/customers/{id}")
    public ResponseEntity<?> getCustomer(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Optional<Customer> customerOpt = customerRepository.findById(id);
        if (customerOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Customer not found");
        }

        Customer customer = customerOpt.get();
        
        // Check access
        if (!customer.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: customer belongs to different merchant");
        }

        if (isEmployee(user)) {
            // Employee can only view customers for stores in their store_access
            Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
            if (storeAccess == null || !storeAccess.contains(customer.getStore().getId().toString())) {
                return ResponseEntity.status(403).body("Forbidden: customer belongs to store you don't have access to");
            }
        }

        return ResponseEntity.ok(customer);
    }

    @PostMapping("/customers")
    @Transactional
    public ResponseEntity<?> createCustomer(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        // Only employees and admins can create customers
        if (!isAdmin(user) && !isEmployee(user)) {
            return ResponseEntity.status(403).body("Forbidden: insufficient permissions to create customers");
        }

        // For employees, ensure they can only create customers for stores they have access to
        UUID storeId;
        try {
            storeId = UUID.fromString(payload.get("storeId").toString());
        } catch (Exception e) {
            return ResponseEntity.status(400).body("storeId is required and must be a valid UUID");
        }

        if (isEmployee(user)) {
            Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
            if (storeAccess == null || !storeAccess.contains(storeId.toString())) {
                return ResponseEntity.status(403).body("Forbidden: you don't have access to this store");
            }
        }

        try {
            Customer customer = new Customer();
            customer.setName(payload.get("name").toString());
            customer.setPhone(payload.containsKey("phone") ? payload.get("phone").toString() : null);
            customer.setEmail(payload.containsKey("email") ? payload.get("email").toString() : null);
            customer.setMerchant(user.getMerchant());
            
            // Set store
            Optional<Store> storeOpt = storeRepository.findById(storeId);
            if (storeOpt.isEmpty()) {
                return ResponseEntity.status(404).body("Store not found");
            }
            Store store = storeOpt.get();
            if (!store.getMerchant().getId().equals(user.getMerchant().getId())) {
                return ResponseEntity.status(403).body("Forbidden: store belongs to different merchant");
            }
            customer.setStore(store);

            Customer saved = customerRepository.save(customer);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error creating customer: " + e.getMessage());
        }
    }

    @PutMapping("/customers/{id}")
    @Transactional
    public ResponseEntity<?> updateCustomer(HttpServletRequest request, @PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        // Only employees and admins can edit customers
        if (!isAdmin(user) && !isEmployee(user)) {
            return ResponseEntity.status(403).body("Forbidden: insufficient permissions to edit customers");
        }

        Optional<Customer> customerOpt = customerRepository.findById(id);
        if (customerOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Customer not found");
        }

        Customer customer = customerOpt.get();
        
        // Check access
        if (!customer.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: customer belongs to different merchant");
        }

        if (isEmployee(user)) {
            // Employee can only edit customers for stores in their store_access
            Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
            if (storeAccess == null || !storeAccess.contains(customer.getStore().getId().toString())) {
                return ResponseEntity.status(403).body("Forbidden: customer belongs to store you don't have access to");
            }
        }

        try {
            if (payload.containsKey("name")) {
                customer.setName(payload.get("name").toString());
            }
            if (payload.containsKey("phone")) {
                customer.setPhone(payload.get("phone") != null ? payload.get("phone").toString() : null);
            }
            if (payload.containsKey("email")) {
                customer.setEmail(payload.get("email") != null ? payload.get("email").toString() : null);
            }

            Customer saved = customerRepository.save(customer);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error updating customer: " + e.getMessage());
        }
    }

    @DeleteMapping("/customers/{id}")
    @Transactional
    public ResponseEntity<?> deleteCustomer(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        // Only admins can delete customers
        if (!isAdmin(user)) {
            return ResponseEntity.status(403).body("Forbidden: only admins can delete customers");
        }

        Optional<Customer> customerOpt = customerRepository.findById(id);
        if (customerOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Customer not found");
        }

        Customer customer = customerOpt.get();
        
        if (!customer.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: customer belongs to different merchant");
        }

        try {
            customerRepository.delete(customer);
            return ResponseEntity.ok(Map.of("message", "Customer deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error deleting customer: " + e.getMessage());
        }
    }

    @GetMapping("/customers/{id}/orders")
    public ResponseEntity<?> getCustomerOrders(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Optional<Customer> customerOpt = customerRepository.findById(id);
        if (customerOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Customer not found");
        }

        Customer customer = customerOpt.get();
        
        // Check access
        if (!customer.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: customer belongs to different merchant");
        }

        if (isEmployee(user)) {
            // Employee can only view orders for customers in stores they have access to
            Set<String> storeAccess = storeContextService.getStoreAccess(request, user);
            if (storeAccess == null || !storeAccess.contains(customer.getStore().getId().toString())) {
                return ResponseEntity.status(403).body("Forbidden: customer belongs to store you don't have access to");
            }
        }

        // TODO: Implement order history query
        // For now, return empty list
        return ResponseEntity.ok(Collections.emptyList());
    }
}

