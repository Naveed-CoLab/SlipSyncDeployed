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
    private final OrderItemRepository orderItemRepository;

    public ProductController(ProductRepository productRepository,
                             ProductVariantRepository variantRepository,
                             CategoryRepository categoryRepository,
                             InventoryRepository inventoryRepository,
                             UserRepository userRepository,
                             StoreContextService storeContextService,
                             OrderItemRepository orderItemRepository) {
        this.productRepository = productRepository;
        this.variantRepository = variantRepository;
        this.categoryRepository = categoryRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.storeContextService = storeContextService;
        this.orderItemRepository = orderItemRepository;
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

        List<Inventory> inventoryList = inventoryRepository.findByStoreIdWithVariantAndProduct(user.getStore().getId());
        
        // Convert to DTO with product and variant info
        List<Map<String, Object>> inventoryDto = inventoryList.stream()
                .map(inv -> {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("id", inv.getId().toString());
                    dto.put("storeId", inv.getStore().getId().toString());
                    dto.put("productVariantId", inv.getVariant().getId().toString());
                    dto.put("productId", inv.getVariant().getProduct().getId().toString());
                    dto.put("productName", inv.getVariant().getProduct().getName());
                    dto.put("variantSku", inv.getVariant().getSku());
                    dto.put("quantity", inv.getQuantity());
                    dto.put("reserved", inv.getReserved());
                    dto.put("reorderPoint", inv.getReorderPoint());
                    dto.put("updatedAt", inv.getUpdatedAt());
                    return dto;
                })
                .toList();
        
        return ResponseEntity.ok(inventoryDto);
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
    
    @PutMapping("/products/{id}")
    @Transactional
    public ResponseEntity<?> updateProduct(HttpServletRequest request, @PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot update products");
        }

        Optional<Product> productOpt = productRepository.findById(id);
        if (productOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Product not found");
        }

        Product product = productOpt.get();
        if (!product.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: product belongs to different merchant");
        }

        try {
            if (payload.containsKey("name")) {
                product.setName((String) payload.get("name"));
            }
            if (payload.containsKey("sku")) {
                product.setSku((String) payload.get("sku"));
            }
            if (payload.containsKey("description")) {
                product.setDescription((String) payload.get("description"));
            }
            if (payload.containsKey("active")) {
                Object activeValue = payload.get("active");
                if (activeValue instanceof Boolean) {
                    product.setActive((Boolean) activeValue);
                } else {
                    product.setActive(Boolean.parseBoolean(activeValue.toString()));
                }
            }
            if (payload.containsKey("categoryId")) {
                Object catIdObj = payload.get("categoryId");
                if (catIdObj != null && !catIdObj.toString().isEmpty() && !catIdObj.toString().equals("none")) {
                    try {
                        UUID catId = UUID.fromString(catIdObj.toString());
                        categoryRepository.findById(catId).ifPresent(product::setCategory);
                    } catch (IllegalArgumentException e) {
                        // Invalid UUID, set to null
                        product.setCategory(null);
                    }
                } else {
                    product.setCategory(null);
                }
            }
            if (payload.containsKey("storeId")) {
                UUID storeId = UUID.fromString((String) payload.get("storeId"));
                // Verify store belongs to merchant
                // This would require a StoreRepository injection - for now, we'll skip this validation
            }

            return ResponseEntity.ok(productRepository.save(product));
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error updating product: " + e.getMessage());
        }
    }

    @DeleteMapping("/products/{id}")
    @Transactional
    public ResponseEntity<?> deleteProduct(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot delete products");
        }

        Optional<Product> productOpt = productRepository.findById(id);
        if (productOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Product not found");
        }

        Product product = productOpt.get();
        if (!product.getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: product belongs to different merchant");
        }

        // Check if product has variants that are referenced in order items
        List<ProductVariant> variants = variantRepository.findByProductId(id);
        long orderItemCount = orderItemRepository.countByProductId(id);
        
        if (orderItemCount > 0) {
            return ResponseEntity.status(400).body(
                "Cannot delete product: This product has been used in " + orderItemCount + 
                " order(s). Products that have been sold cannot be deleted to maintain order history integrity."
            );
        }

        try {
            productRepository.delete(product);
            return ResponseEntity.ok(Map.of("message", "Product deleted successfully"));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(400).body(
                "Cannot delete product: This product is referenced in existing orders. " +
                "Products that have been sold cannot be deleted to maintain order history integrity."
            );
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error deleting product: " + e.getMessage());
        }
    }

    // --- VARIANTS ---

    @GetMapping("/variants")
    public ResponseEntity<?> getVariants(HttpServletRequest request, @RequestParam(required = false) UUID productId) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        if (productId != null) {
            List<ProductVariant> variants = variantRepository.findByProductId(productId);
            // Verify product belongs to merchant
            Optional<Product> productOpt = productRepository.findById(productId);
            if (productOpt.isPresent() && !productOpt.get().getMerchant().getId().equals(user.getMerchant().getId())) {
                return ResponseEntity.status(403).body("Forbidden: product belongs to different merchant");
            }
            return ResponseEntity.ok(variants);
        }

        // Return all variants for merchant's products
        List<Product> products = productRepository.findByMerchantId(user.getMerchant().getId());
        List<ProductVariant> allVariants = products.stream()
                .flatMap(prod -> variantRepository.findByProductId(prod.getId()).stream())
                .toList();
        return ResponseEntity.ok(allVariants);
    }

    @PostMapping("/variants")
    @Transactional
    public ResponseEntity<?> createVariant(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot create variants");
        }

        try {
            UUID productId = UUID.fromString((String) payload.get("productId"));
            Optional<Product> productOpt = productRepository.findById(productId);
            if (productOpt.isEmpty()) {
                return ResponseEntity.status(404).body("Product not found");
            }

            Product product = productOpt.get();
            if (!product.getMerchant().getId().equals(user.getMerchant().getId())) {
                return ResponseEntity.status(403).body("Forbidden: product belongs to different merchant");
            }

            ProductVariant variant = new ProductVariant();
            variant.setProduct(product);
            variant.setSku((String) payload.get("sku"));
            variant.setBarcode((String) payload.get("barcode"));
            
            Object priceObj = payload.get("price");
            if (priceObj == null) {
                throw new IllegalArgumentException("Price is required");
            }
            variant.setPrice(new BigDecimal(priceObj.toString()));
            
            if (payload.containsKey("cost")) {
                variant.setCost(new BigDecimal(payload.get("cost").toString()));
            }

            ProductVariant savedVariant = variantRepository.save(variant);

            // Optionally create inventory for current store
            if (user.getStore() != null && payload.containsKey("initialStock")) {
                int initialStock = Integer.parseInt(payload.get("initialStock").toString());
                if (initialStock > 0) {
                    Inventory inventory = new Inventory();
                    inventory.setStore(user.getStore());
                    inventory.setVariant(savedVariant);
                    inventory.setQuantity(initialStock);
                    if (payload.containsKey("reorderPoint")) {
                        inventory.setReorderPoint(Integer.parseInt(payload.get("reorderPoint").toString()));
                    }
                    inventoryRepository.save(inventory);
                }
            }

            return ResponseEntity.ok(savedVariant);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error creating variant: " + e.getMessage());
        }
    }

    @PutMapping("/variants/{id}")
    @Transactional
    public ResponseEntity<?> updateVariant(HttpServletRequest request, @PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot update variants");
        }

        Optional<ProductVariant> variantOpt = variantRepository.findById(id);
        if (variantOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Variant not found");
        }

        ProductVariant variant = variantOpt.get();
        if (!variant.getProduct().getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: variant belongs to different merchant");
        }

        try {
            if (payload.containsKey("sku")) {
                variant.setSku((String) payload.get("sku"));
            }
            if (payload.containsKey("barcode")) {
                variant.setBarcode((String) payload.get("barcode"));
            }
            if (payload.containsKey("price")) {
                variant.setPrice(new BigDecimal(payload.get("price").toString()));
            }
            if (payload.containsKey("cost")) {
                variant.setCost(new BigDecimal(payload.get("cost").toString()));
            }

            return ResponseEntity.ok(variantRepository.save(variant));
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error updating variant: " + e.getMessage());
        }
    }

    @DeleteMapping("/variants/{id}")
    @Transactional
    public ResponseEntity<?> deleteVariant(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot delete variants");
        }

        Optional<ProductVariant> variantOpt = variantRepository.findById(id);
        if (variantOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Variant not found");
        }

        ProductVariant variant = variantOpt.get();
        if (!variant.getProduct().getMerchant().getId().equals(user.getMerchant().getId())) {
            return ResponseEntity.status(403).body("Forbidden: variant belongs to different merchant");
        }

        // Check if variant is referenced in order items
        long orderItemCount = orderItemRepository.countByVariantId(id);
        if (orderItemCount > 0) {
            return ResponseEntity.status(400).body(
                "Cannot delete variant: This variant has been used in " + orderItemCount + 
                " order(s). Variants that have been sold cannot be deleted to maintain order history integrity."
            );
        }

        try {
            variantRepository.delete(variant);
            return ResponseEntity.ok(Map.of("message", "Variant deleted successfully"));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(400).body(
                "Cannot delete variant: This variant is referenced in existing orders. " +
                "Variants that have been sold cannot be deleted to maintain order history integrity."
            );
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error deleting variant: " + e.getMessage());
        }
    }

    // --- INVENTORY ---

    @PutMapping("/inventory/{id}")
    @Transactional
    public ResponseEntity<?> updateInventory(HttpServletRequest request, @PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null) return ResponseEntity.status(400).body("User is not assigned to a store");
        if (!canManageProducts(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot update inventory");
        }

        Optional<Inventory> inventoryOpt = inventoryRepository.findById(id);
        if (inventoryOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Inventory not found");
        }

        Inventory inventory = inventoryOpt.get();
        if (!inventory.getStore().getId().equals(user.getStore().getId())) {
            return ResponseEntity.status(403).body("Forbidden: inventory belongs to different store");
        }

        try {
            if (payload.containsKey("quantity")) {
                int quantity = Integer.parseInt(payload.get("quantity").toString());
                if (quantity < 0) {
                    return ResponseEntity.status(400).body("Quantity cannot be negative");
                }
                inventory.setQuantity(quantity);
            }
            if (payload.containsKey("reserved")) {
                int reserved = Integer.parseInt(payload.get("reserved").toString());
                if (reserved < 0) {
                    return ResponseEntity.status(400).body("Reserved cannot be negative");
                }
                inventory.setReserved(reserved);
            }
            if (payload.containsKey("reorderPoint")) {
                inventory.setReorderPoint(Integer.parseInt(payload.get("reorderPoint").toString()));
            }

            return ResponseEntity.ok(inventoryRepository.save(inventory));
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error updating inventory: " + e.getMessage());
        }
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