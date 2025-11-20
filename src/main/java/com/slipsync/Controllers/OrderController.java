package com.slipsync.Controllers;

import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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

    public OrderController(OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            InvoiceRepository invoiceRepository,
            ProductVariantRepository variantRepository,
            InventoryRepository inventoryRepository,
            CustomerRepository customerRepository,
            UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.invoiceRepository = invoiceRepository;
        this.variantRepository = variantRepository;
        this.inventoryRepository = inventoryRepository;
        this.customerRepository = customerRepository;
        this.userRepository = userRepository;
    }

    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId).orElse(null);
    }

    // --- GET ORDERS ---
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null)
            return ResponseEntity.status(400).body("No store assigned");

        List<Order> orders = orderRepository.findByStoreIdOrderByPlacedAtDesc(user.getStore().getId());
        return ResponseEntity.ok(orders);
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

        try {
            // 1. Create Order Object
            Order order = new Order();
            order.setMerchant(user.getMerchant());
            order.setStore(currentStore);
            order.setOrderNumber("ORD-" + System.currentTimeMillis()); // Simple generator
            order.setStatus("paid"); // Assuming immediate payment for MVP

            // Handle Customer (Optional)
            if (payload.containsKey("customerId") && payload.get("customerId") != null) {
                UUID customerId = UUID.fromString((String) payload.get("customerId"));
                customerRepository.findById(customerId).ifPresent(order::setCustomer);
            }
            // Else: customer remains null (Walk-in)

            Order savedOrder = orderRepository.save(order);

            BigDecimal orderTotal = BigDecimal.ZERO;
            List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");

            // 2. Process Items
            for (Map<String, Object> itemData : items) {
                UUID variantId = UUID.fromString((String) itemData.get("productVariantId"));
                Integer qty = (Integer) itemData.get("quantity");

                ProductVariant variant = variantRepository.findById(variantId)
                        .orElseThrow(() -> new RuntimeException("Variant not found: " + variantId));

                // A. Create Order Item
                OrderItem orderItem = new OrderItem();
                orderItem.setOrder(savedOrder);
                orderItem.setVariant(variant);
                orderItem.setQuantity(qty);
                orderItem.setUnitPrice(variant.getPrice());

                BigDecimal lineTotal = variant.getPrice().multiply(new BigDecimal(qty));
                orderItem.setTotalPrice(lineTotal);

                orderItemRepository.save(orderItem);
                orderTotal = orderTotal.add(lineTotal);

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
            savedOrder.setSubtotal(orderTotal);
            // Tax logic can be added here later (e.g. orderTotal * 0.10)
            savedOrder.setTotalAmount(orderTotal);
            orderRepository.save(savedOrder);

            // 4. Generate Invoice Record
            Invoice invoice = new Invoice();
            invoice.setOrder(savedOrder);
            invoice.setMerchant(user.getMerchant());
            invoice.setInvoiceNumber("INV-" + savedOrder.getOrderNumber());
            invoice.setTotal(orderTotal);
            invoiceRepository.save(invoice);

            return ResponseEntity.ok(savedOrder);

        } catch (Exception e) {
            // Transactional annotation ensures all DB changes (Order, Items, Inventory)
            // roll back on error
            return ResponseEntity.status(400).body("Order failed: " + e.getMessage());
        }
    }
}