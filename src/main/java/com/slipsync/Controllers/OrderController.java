package com.slipsync.Controllers;

import com.slipsync.DTO.OrderSummaryDto;
import com.slipsync.DTO.OrderDetailDto;
import com.slipsync.DTO.OrderItemDetailDto;
import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProductVariantRepository variantRepository;
    private final InventoryRepository inventoryRepository;
    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final StoreContextService storeContextService;

    public OrderController(OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            InvoiceRepository invoiceRepository,
            ProductVariantRepository variantRepository,
            InventoryRepository inventoryRepository,
            CustomerRepository customerRepository,
            UserRepository userRepository,
            StoreContextService storeContextService) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.invoiceRepository = invoiceRepository;
        this.variantRepository = variantRepository;
        this.inventoryRepository = inventoryRepository;
        this.customerRepository = customerRepository;
        this.userRepository = userRepository;
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

    // --- GET ORDERS ---
    @GetMapping("/orders/{id}")
    public ResponseEntity<?> getOrderDetails(HttpServletRequest request, @PathVariable UUID id) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null)
            return ResponseEntity.status(400).body("No store assigned");

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Order not found");
        }

        Order order = orderOpt.get();
        
        // Check if order belongs to user's store
        if (!order.getStore().getId().equals(user.getStore().getId())) {
            return ResponseEntity.status(403).body("Forbidden: order belongs to different store");
        }

        // Fetch order items with product and variant info
        List<OrderItem> orderItems = orderItemRepository.findByOrderIdWithVariantAndProduct(id);
        
        List<OrderItemDetailDto> itemDtos = orderItems.stream()
                .map(item -> {
                    ProductVariant variant = item.getVariant();
                    Product product = variant.getProduct();
                    return new OrderItemDetailDto(
                            item.getId(),
                            variant.getId(),
                            product.getId(),
                            product.getName(),
                            variant.getSku(),
                            variant.getBarcode(),
                            item.getQuantity(),
                            item.getUnitPrice(),
                            item.getDiscountsTotal() != null ? item.getDiscountsTotal() : BigDecimal.ZERO,
                            item.getTaxesTotal() != null ? item.getTaxesTotal() : BigDecimal.ZERO,
                            item.getTotalPrice()
                    );
                })
                .toList();

        String customerName = order.getCustomer() != null && order.getCustomer().getName() != null
                ? order.getCustomer().getName()
                : "Walk-in";
        String customerEmail = order.getCustomer() != null ? order.getCustomer().getEmail() : null;
        String customerPhone = order.getCustomer() != null ? order.getCustomer().getPhone() : null;
        UUID customerId = order.getCustomer() != null ? order.getCustomer().getId() : null;

        OrderDetailDto orderDetail = new OrderDetailDto(
                order.getId(),
                order.getOrderNumber(),
                order.getStatus(),
                customerId,
                customerName,
                customerEmail,
                customerPhone,
                order.getSubtotal() != null ? order.getSubtotal() : BigDecimal.ZERO,
                order.getDiscountsTotal() != null ? order.getDiscountsTotal() : BigDecimal.ZERO,
                order.getTaxesTotal() != null ? order.getTaxesTotal() : BigDecimal.ZERO,
                order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO,
                order.getCurrency() != null ? order.getCurrency() : "PKR",
                order.getPlacedAt(),
                order.getFulfilledAt(),
                itemDtos
        );

        return ResponseEntity.ok(orderDetail);
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null)
            return ResponseEntity.status(400).body("No store assigned");

        List<Order> orders = orderRepository.findByStoreIdOrderByPlacedAtDesc(user.getStore().getId());

        List<OrderSummaryDto> response = orders.stream()
                .map(order -> {
                    long itemCount = orderItemRepository.countByOrderId(order.getId());
                    String customerName = order.getCustomer() != null
                            ? (order.getCustomer().getName() != null ? order.getCustomer().getName() : "Customer")
                            : "Walk-in";
                    String currency = order.getStore() != null && order.getStore().getCurrency() != null
                            ? order.getStore().getCurrency()
                            : user.getMerchant().getCurrency();

                    BigDecimal subtotal = order.getSubtotal() != null ? order.getSubtotal() : BigDecimal.ZERO;
                    BigDecimal taxes = order.getTaxesTotal() != null ? order.getTaxesTotal() : BigDecimal.ZERO;
                    BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : subtotal.add(taxes);

                    return new OrderSummaryDto(
                            order.getId(),
                            order.getOrderNumber(),
                            order.getStatus(),
                            subtotal,
                            taxes,
                            total,
                            order.getPlacedAt(),
                            customerName,
                            (int) itemCount,
                            currency);
                })
                .toList();

        return ResponseEntity.ok(response);
    }

    // --- CREATE ORDER (Billing) ---
    @PostMapping("/orders")
    @Transactional
    public ResponseEntity<?> createOrder(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");
        Store currentStore = user.getStore();
        if (currentStore == null)
            return ResponseEntity.status(400).body("No store assigned to user");
        if (!hasPosAccess(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot process orders");
        }

        try {
            // 1. Create Order Object
            Order order = new Order();
            order.setMerchant(user.getMerchant());
            order.setStore(currentStore);
            order.setOrderNumber("ORD-" + System.currentTimeMillis()); // Simple generator
            String status = payload.getOrDefault("status", "paid").toString();
            order.setStatus(status);

            // Handle Customer (Optional)
            // Priority: 1) customerId (existing), 2) customer data (create new), 3) null (walk-in)
            if (payload.containsKey("customerId") && payload.get("customerId") != null) {
                // Use existing customer
                UUID customerId = UUID.fromString((String) payload.get("customerId"));
                customerRepository.findById(customerId).ifPresent(order::setCustomer);
            } else if (payload.containsKey("customer") && payload.get("customer") != null) {
                // Create new customer during order processing (NO duplicate checks)
                @SuppressWarnings("unchecked")
                Map<String, Object> customerData = (Map<String, Object>) payload.get("customer");
                
                Customer newCustomer = new Customer();
                newCustomer.setName(customerData.get("name") != null ? customerData.get("name").toString() : "Customer");
                newCustomer.setPhone(customerData.containsKey("phone") && customerData.get("phone") != null 
                    ? customerData.get("phone").toString() : null);
                newCustomer.setEmail(customerData.containsKey("email") && customerData.get("email") != null 
                    ? customerData.get("email").toString() : null);
                newCustomer.setMerchant(user.getMerchant());
                newCustomer.setStore(currentStore);
                
                // Save customer (no duplicate checks - always create new)
                Customer savedCustomer = customerRepository.save(newCustomer);
                order.setCustomer(savedCustomer);
            }
            // Else: customer remains null (Walk-in)

            Order savedOrder = orderRepository.save(order);

            BigDecimal subtotal = BigDecimal.ZERO;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");
            if (items == null || items.isEmpty()) {
                return ResponseEntity.status(400).body("Order items are required");
            }

            // 2. Process Items
            for (Map<String, Object> itemData : items) {
                Object variantObj = itemData.get("productVariantId");
                Object qtyObj = itemData.get("quantity");
                if (variantObj == null || qtyObj == null) {
                    return ResponseEntity.status(400).body("Each line item must include productVariantId and quantity");
                }
                UUID variantId = UUID.fromString(variantObj.toString());
                int qty = Integer.parseInt(qtyObj.toString());
                if (qty <= 0) {
                    return ResponseEntity.status(400).body("Quantity must be greater than zero");
                }

                ProductVariant variant = variantRepository.findById(variantId)
                        .orElseThrow(() -> new RuntimeException("Variant not found: " + variantId));

                // A. Create Order Item
                OrderItem orderItem = new OrderItem();
                orderItem.setOrder(savedOrder);
                orderItem.setVariant(variant);
                orderItem.setQuantity(qty);
                BigDecimal unitPrice = itemData.containsKey("unitPrice") && itemData.get("unitPrice") != null
                        ? new BigDecimal(itemData.get("unitPrice").toString())
                        : variant.getPrice();
                orderItem.setUnitPrice(unitPrice);

                BigDecimal lineTotal = unitPrice.multiply(new BigDecimal(qty));
                orderItem.setTotalPrice(lineTotal);
                orderItem.setDiscountsTotal(BigDecimal.ZERO);
                orderItem.setTaxesTotal(BigDecimal.ZERO);

                orderItemRepository.save(orderItem);
                subtotal = subtotal.add(lineTotal);

                // B. Decrement Inventory
                Inventory inventory = inventoryRepository.findByStoreIdAndVariantId(currentStore.getId(), variantId)
                        .orElseThrow(() -> new RuntimeException(
                                "Stock record not found for: " + variant.getProduct().getName()));

                if (inventory.getQuantity() < qty) {
                    return ResponseEntity.status(400).body("Insufficient stock for: " + variant.getProduct().getName());

                }
                inventory.setQuantity(inventory.getQuantity() - qty);
                inventoryRepository.save(inventory);
            }

            // 3. Finalize Order Totals
            BigDecimal discountAmount = payload.containsKey("discountAmount") && payload.get("discountAmount") != null
                    ? new BigDecimal(payload.get("discountAmount").toString())
                    : BigDecimal.ZERO;
            if (discountAmount.compareTo(BigDecimal.ZERO) < 0) {
                discountAmount = BigDecimal.ZERO;
            }
            if (discountAmount.compareTo(subtotal) > 0) {
                discountAmount = subtotal;
            }

            BigDecimal taxRate = payload.containsKey("taxRate") && payload.get("taxRate") != null
                    ? new BigDecimal(payload.get("taxRate").toString())
                    : BigDecimal.ZERO;
            if (taxRate.compareTo(BigDecimal.ZERO) < 0) {
                taxRate = BigDecimal.ZERO;
            }
            BigDecimal taxableBase = subtotal.subtract(discountAmount);
            if (taxableBase.compareTo(BigDecimal.ZERO) < 0) {
                taxableBase = BigDecimal.ZERO;
            }
            BigDecimal taxes = taxableBase.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal total = taxableBase.add(taxes);

            savedOrder.setSubtotal(subtotal);
            savedOrder.setDiscountsTotal(discountAmount);
            savedOrder.setTaxesTotal(taxes);
            savedOrder.setTotalAmount(total);
            savedOrder.setCurrency(currentStore.getCurrency() != null ? currentStore.getCurrency()
                    : user.getMerchant().getCurrency());
            orderRepository.save(savedOrder);

            // 4. Generate Invoice Record
            Invoice invoice = new Invoice();
            invoice.setOrder(savedOrder);
            invoice.setMerchant(user.getMerchant());
            invoice.setStore(currentStore);
            invoice.setInvoiceNumber("INV-" + savedOrder.getOrderNumber());
            invoice.setTotal(total);
            invoice.setCurrency(savedOrder.getCurrency());
            invoiceRepository.save(invoice);

            return ResponseEntity.ok(savedOrder);

        } catch (Exception e) {
            // Transactional annotation ensures all DB changes (Order, Items, Inventory)
            // roll back on error
            return ResponseEntity.status(400).body("Order failed: " + e.getMessage());
        }
    }

    private boolean hasPosAccess(User user) {
        if (user == null || user.getRole() == null || user.getRole().getName() == null) {
            return false;
        }
        String role = user.getRole().getName().toUpperCase(Locale.ROOT);
        return role.equals("ADMIN") || role.equals("EMPLOYEE");
    }
}