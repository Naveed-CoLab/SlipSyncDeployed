package com.slipsync.Controllers;

import com.slipsync.DTO.SalesReportDto;
import com.slipsync.Entities.Order;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.OrderRepository;
import com.slipsync.Repositories.UserRepository;
import com.slipsync.Services.PermissionService;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final StoreContextService storeContextService;
    private final PermissionService permissionService;

    public ReportController(OrderRepository orderRepository,
                            UserRepository userRepository,
                            StoreContextService storeContextService,
                            PermissionService permissionService) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.storeContextService = storeContextService;
        this.permissionService = permissionService;
    }

    @GetMapping("/sales/summary")
    public ResponseEntity<?> getSalesSummary(@RequestParam(defaultValue = "daily") String range,
                                             HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        if (!hasReportingAccess(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot view reports");
        }
        Store store = user.getStore();
        if (store == null) {
            return ResponseEntity.status(400).body("No store assigned");
        }

        String normalizedRange = normalizeRange(range);
        DateWindow window = resolveWindow(normalizedRange, store);
        List<Order> orders = orderRepository.findByStoreIdAndPlacedAtBetweenOrderByPlacedAtDesc(
                store.getId(), window.start(), window.end());

        SalesReportDto summary = buildSummary(normalizedRange, orders);
        return ResponseEntity.ok(summary);
    }

    @GetMapping(value = "/sales/export", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<?> exportSalesCsv(@RequestParam(defaultValue = "daily") String range,
                                            HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        if (!hasReportingAccess(user)) {
            return ResponseEntity.status(403).body("Forbidden: role cannot export reports");
        }
        Store store = user.getStore();
        if (store == null) {
            return ResponseEntity.status(400).body("No store assigned");
        }

        String normalizedRange = normalizeRange(range);
        DateWindow window = resolveWindow(normalizedRange, store);
        List<Order> orders = orderRepository.findByStoreIdAndPlacedAtBetweenOrderByPlacedAtDesc(
                store.getId(), window.start(), window.end());

        String csv = buildCsv(orders);
        String filename = "sales-" + normalizedRange + "-" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv);
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

    private boolean hasReportingAccess(User user) {
        if (user == null) {
            return false;
        }
        // Use PermissionService to check if user can view reports
        // This handles both ADMIN/EMPLOYEE and org:admin/org:employee role names
        return permissionService.hasPermission(user, "view_reports");
    }

    private String normalizeRange(String range) {
        if (range == null) return "daily";
        String lowered = range.toLowerCase(Locale.ROOT);
        return switch (lowered) {
            case "monthly", "month" -> "monthly";
            default -> "daily";
        };
    }

    private DateWindow resolveWindow(String range, Store store) {
        ZoneId zoneId = resolveZone(store);
        ZonedDateTime now = ZonedDateTime.now(zoneId);
        ZonedDateTime start;
        if ("monthly".equals(range)) {
            start = now.withDayOfMonth(1).toLocalDate().atStartOfDay(zoneId);
        } else {
            start = now.toLocalDate().atStartOfDay(zoneId);
        }
        return new DateWindow(start.toLocalDateTime(), now.toLocalDateTime());
    }

    private ZoneId resolveZone(Store store) {
        if (store != null && store.getTimezone() != null && !store.getTimezone().isBlank()) {
            try {
                return ZoneId.of(store.getTimezone());
            } catch (Exception ignored) {
            }
        }
        return ZoneId.systemDefault();
    }

    private SalesReportDto buildSummary(String range, List<Order> orders) {
        BigDecimal gross = orders.stream()
                .map(order -> order.getSubtotal() != null ? order.getSubtotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discounts = orders.stream()
                .map(order -> order.getDiscountsTotal() != null ? order.getDiscountsTotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxes = orders.stream()
                .map(order -> order.getTaxesTotal() != null ? order.getTaxesTotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = orders.stream()
                .map(order -> order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new SalesReportDto(range, gross, discounts, taxes, net, orders.size());
    }

    private String buildCsv(List<Order> orders) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        String header = "Order Number,Placed At,Subtotal,Discounts,Taxes,Total,Currency";
        String rows = orders.stream()
                .map(order -> {
                    String orderNumber = order.getOrderNumber() != null ? order.getOrderNumber() : "";
                    String placedAt = order.getPlacedAt() != null ? formatter.format(order.getPlacedAt()) : "";
                    BigDecimal subtotal = order.getSubtotal() != null ? order.getSubtotal() : BigDecimal.ZERO;
                    BigDecimal discounts = order.getDiscountsTotal() != null ? order.getDiscountsTotal() : BigDecimal.ZERO;
                    BigDecimal taxes = order.getTaxesTotal() != null ? order.getTaxesTotal() : BigDecimal.ZERO;
                    BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
                    String currency = order.getCurrency() != null ? order.getCurrency() : "";
                    return String.join(",",
                            escape(orderNumber),
                            escape(placedAt),
                            subtotal.toPlainString(),
                            discounts.toPlainString(),
                            taxes.toPlainString(),
                            total.toPlainString(),
                            escape(currency));
                })
                .collect(Collectors.joining("\n"));

        return header + "\n" + rows;
    }

    private String escape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private record DateWindow(LocalDateTime start, LocalDateTime end) {
    }
}

