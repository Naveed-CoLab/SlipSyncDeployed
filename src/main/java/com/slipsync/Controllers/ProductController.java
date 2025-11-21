package com.slipsync.Controllers;

import com.slipsync.DTO.ProductInventoryDto;
import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final StoreContextService storeContextService;

    public ProductController(ProductRepository productRepository,
                             ProductVariantRepository variantRepository,
                             CategoryRepository categoryRepository,
                             InventoryRepository inventoryRepository,
                             UserRepository userRepository,
                             StoreContextService storeContextService) {
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
        this.categoryRepository = categoryRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.storeContextService = storeContextService;
    }

    // Helper to get the User for the current request
    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId)
                .map(user -> {
                    storeContextService.attachStore(user, request);
                    return user;
                })
                .orElse(null);
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
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot create products");
        }
        if (user.getStore() == null) {
            return ResponseEntity.status(400).body("Assign yourself to a store before creating products");
        }

        try {
            // 1. Create Product
            Product product = new Product();
            product.setName((String) payload.get("name"));
            product.setSku((String) payload.get("sku"));
            product.setDescription((String) payload.get("description"));
            product.setMerchant(user.getMerchant());
            product.setStore(user.getStore());

            if (payload.containsKey("categoryId")) {
                UUID catId = UUID.fromString((String) payload.get("categoryId"));
                categoryRepository.findById(catId).ifPresent(product::setCategory);
            }
            
            Product savedProduct = productRepository.save(product);

            // 2. Create First Variant (Default)
            ProductVariant variant = new ProductVariant();
            variant.setProduct(savedProduct);
            variant.setSku((String) payload.get("sku")); // Default variant shares product SKU often
            Object priceObj = payload.get("price");
            if (priceObj == null) {
                throw new IllegalArgumentException("Price is required");
            }
            variant.setPrice(new BigDecimal(priceObj.toString()));
            if (payload.containsKey("cost")) {
                variant.setCost(new BigDecimal(payload.get("cost").toString()));
            }
            if (payload.containsKey("barcode")) {
                variant.setBarcode(String.valueOf(payload.get("barcode")));
            }
            ProductVariant savedVariant = variantRepository.save(variant);

            // 3. Initialize Inventory for CURRENT Store
            Store currentStore = user.getStore();
            if (currentStore != null) {
                Inventory inventory = new Inventory();
                inventory.setStore(currentStore);
                inventory.setVariant(savedVariant);
                int initialStock = Integer.parseInt(payload.getOrDefault("initialStock", "0").toString());
                if (initialStock < 0) {
                    throw new IllegalArgumentException("Initial stock cannot be negative");
                }
                inventory.setQuantity(initialStock);
                if (payload.containsKey("reorderPoint")) {
                    inventory.setReorderPoint(Integer.parseInt(payload.get("reorderPoint").toString()));
                }
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

    @GetMapping("/products/overview")
    public ResponseEntity<?> getProductOverview(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        if (user.getStore() == null) {
            return ResponseEntity.status(400).body("User is not assigned to a store");
        }

        List<ProductInventoryDto> overview = variantRepository.findInventoryOverview(
                user.getMerchant().getId(),
                user.getStore().getId());

        if (overview.isEmpty()) {
            List<Product> products = productRepository.findByMerchantId(user.getMerchant().getId());
            UUID activeStoreId = user.getStore().getId();

            overview = products.stream()
                    .filter(prod -> prod.getStore() == null || prod.getStore().getId().equals(activeStoreId))
                    .flatMap(prod -> variantRepository.findByProductId(prod.getId()).stream()
                            .map(variant -> new ProductInventoryDto(
                                    null,
                                    prod.getId(),
                                    variant.getId(),
                                    prod.getName(),
                                    variant.getSku(),
                                    variant.getBarcode(),
                                    variant.getPrice(),
                                    variant.getCost(),
                                    0,
                                    0,
                                    prod.getCreatedAt())))
                    .toList();
        }

        return ResponseEntity.ok(overview);
    }
    
    @PutMapping("/inventory/adjust")
    public ResponseEntity<?> adjustInventory(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null) return ResponseEntity.status(400).body("User is not assigned to a store");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot adjust stock");
        }

        try {
            UUID variantId = UUID.fromString((String) payload.get("productVariantId"));
            Integer adjustment = Integer.parseInt(payload.get("quantityChange").toString()); 

            Optional<Inventory> inventoryOpt = inventoryRepository.findByStoreIdAndVariantId(user.getStore().getId(), variantId);
            
            if (inventoryOpt.isPresent()) {
                Inventory inventory = inventoryOpt.get();
                int newQuantity = inventory.getQuantity() + adjustment;
                if (newQuantity < 0) {
                    return ResponseEntity.status(400).body("Adjustment would result in negative stock");
                }
                inventory.setQuantity(newQuantity);
                if (payload.containsKey("reorderPoint")) {
                    inventory.setReorderPoint(Integer.parseInt(payload.get("reorderPoint").toString()));
                }
                return ResponseEntity.ok(inventoryRepository.save(inventory));
            } else {
                // Create new inventory record if it doesn't exist
                ProductVariant variant = variantRepository.findById(variantId)
                        .orElseThrow(() -> new RuntimeException("Variant not found"));
                
                Inventory newInventory = new Inventory();
                newInventory.setStore(user.getStore());
                newInventory.setVariant(variant);
                if (adjustment < 0) {
                    return ResponseEntity.status(400).body("Cannot set negative stock for new inventory");
                }
                newInventory.setQuantity(adjustment);
                if (payload.containsKey("reorderPoint")) {
                    newInventory.setReorderPoint(Integer.parseInt(payload.get("reorderPoint").toString()));
                }
                return ResponseEntity.ok(inventoryRepository.save(newInventory));
            }

        } catch (Exception e) {
             return ResponseEntity.status(400).body("Error adjusting inventory: " + e.getMessage());
        }
    }

    private boolean canManageProducts(User user) {
        if (user == null || user.getRole() == null || user.getRole().getName() == null) {
            return false;
        }
        String role = user.getRole().getName().toUpperCase(Locale.ROOT);
        return role.equals("ADMIN") || role.equals("EMPLOYEE");
    }
}