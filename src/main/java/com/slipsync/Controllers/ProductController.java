package com.slipsync.Controllers;

import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryRepository inventoryRepository;
    private final UserRepository userRepository;

    public ProductController(ProductRepository productRepository,
                             ProductVariantRepository variantRepository,
                             CategoryRepository categoryRepository,
                             InventoryRepository inventoryRepository,
                             UserRepository userRepository,
                             StoreRepository storeRepository) {
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
        this.categoryRepository = categoryRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
    }

    // Helper to get the User for the current request
    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId).orElse(null);
    }

    // --- CATEGORIES ---

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Category> categories = categoryRepository.findByMerchantId(user.getMerchant().getId());
        return ResponseEntity.ok(categories);
    }

    @PostMapping("/categories")
    public ResponseEntity<?> createCategory(HttpServletRequest request, @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Category category = new Category();
        category.setName(payload.get("name"));
        category.setMerchant(user.getMerchant());
        
        // Optional parent ID
        if (payload.containsKey("parentId")) {
             UUID parentId = UUID.fromString(payload.get("parentId"));
             categoryRepository.findById(parentId).ifPresent(category::setParent);
        }

        return ResponseEntity.ok(categoryRepository.save(category));
    }

    // --- PRODUCTS ---

    @GetMapping("/products")
    public ResponseEntity<?> getProducts(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Product> products = productRepository.findByMerchantId(user.getMerchant().getId());
        // In a real app, you might want to fetch variants here too, or rely on lazy loading serialization
        return ResponseEntity.ok(products);
    }

    @PostMapping("/products")
    @Transactional
    public ResponseEntity<?> createProduct(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        try {
            // 1. Create Product
            Product product = new Product();
            product.setName((String) payload.get("name"));
            product.setSku((String) payload.get("sku"));
            product.setDescription((String) payload.get("description"));
            product.setMerchant(user.getMerchant());

            if (payload.containsKey("categoryId")) {
                UUID catId = UUID.fromString((String) payload.get("categoryId"));
                categoryRepository.findById(catId).ifPresent(product::setCategory);
            }
            
            Product savedProduct = productRepository.save(product);

            // 2. Create First Variant (Default)
            ProductVariant variant = new ProductVariant();
            variant.setProduct(savedProduct);
            variant.setSku((String) payload.get("sku")); // Default variant shares product SKU often
            variant.setPrice(new BigDecimal(payload.get("price").toString()));
            if (payload.containsKey("cost")) {
                variant.setCost(new BigDecimal(payload.get("cost").toString()));
            }
            ProductVariant savedVariant = variantRepository.save(variant);

            // 3. Initialize Inventory for CURRENT Store
            Store currentStore = user.getStore();
            if (currentStore != null) {
                Inventory inventory = new Inventory();
                inventory.setStore(currentStore);
                inventory.setVariant(savedVariant);
                inventory.setQuantity(Integer.parseInt(payload.getOrDefault("initialStock", "0").toString()));
                inventoryRepository.save(inventory);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("product", savedProduct);
            response.put("variant", savedVariant);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error creating product: " + e.getMessage());
        }
    }
    
    // --- INVENTORY ---

    @GetMapping("/inventory")
    public ResponseEntity<?> getInventory(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        
        // Assuming user views inventory for their assigned store
        if (user.getStore() == null) {
             return ResponseEntity.status(400).body("User is not assigned to a store");
        }

        List<Inventory> inventoryList = inventoryRepository.findByStoreId(user.getStore().getId());
        return ResponseEntity.ok(inventoryList);
    }
    
    @PutMapping("/inventory/adjust")
    public ResponseEntity<?> adjustInventory(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null) return ResponseEntity.status(400).body("User is not assigned to a store");

        try {
            UUID variantId = UUID.fromString((String) payload.get("productVariantId"));
            Integer adjustment = Integer.parseInt(payload.get("quantityChange").toString()); 

            Optional<Inventory> inventoryOpt = inventoryRepository.findByStoreIdAndVariantId(user.getStore().getId(), variantId);
            
            if (inventoryOpt.isPresent()) {
                Inventory inventory = inventoryOpt.get();
                inventory.setQuantity(inventory.getQuantity() + adjustment);
                return ResponseEntity.ok(inventoryRepository.save(inventory));
            } else {
                // Create new inventory record if it doesn't exist
                ProductVariant variant = variantRepository.findById(variantId)
                        .orElseThrow(() -> new RuntimeException("Variant not found"));
                
                Inventory newInventory = new Inventory();
                newInventory.setStore(user.getStore());
                newInventory.setVariant(variant);
                newInventory.setQuantity(adjustment);
                return ResponseEntity.ok(inventoryRepository.save(newInventory));
            }

        } catch (Exception e) {
             return ResponseEntity.status(400).body("Error adjusting inventory: " + e.getMessage());
        }
    }
}