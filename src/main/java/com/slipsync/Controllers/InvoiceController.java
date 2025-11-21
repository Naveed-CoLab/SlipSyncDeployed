package com.slipsync.Controllers;

import com.slipsync.DTO.InvoiceSummaryDto;
import com.slipsync.Entities.Invoice;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import com.slipsync.Repositories.InvoiceRepository;
import com.slipsync.Repositories.UserRepository;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api")
public class InvoiceController {

    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;
    private final StoreContextService storeContextService;

    public InvoiceController(InvoiceRepository invoiceRepository,
                             UserRepository userRepository,
                             StoreContextService storeContextService) {
        this.invoiceRepository = invoiceRepository;
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

    @GetMapping("/invoices")
    public ResponseEntity<?> getInvoices(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        Store store = user.getStore();
        if (store == null) {
            return ResponseEntity.status(400).body("No store assigned");
        }

        List<InvoiceSummaryDto> invoices = invoiceRepository
                .findTop10ByStoreIdOrderByIssuedAtDesc(store.getId())
                .stream()
                .map(invoice -> toDto(invoice, store))
                .toList();

        return ResponseEntity.ok(invoices);
    }

            private InvoiceSummaryDto toDto(Invoice invoice, Store store) {
        BigDecimal total = invoice.getTotal() != null ? invoice.getTotal() : BigDecimal.ZERO;
        String orderNumber = invoice.getOrder() != null ? invoice.getOrder().getOrderNumber() : null;
                String currency = invoice.getCurrency() != null
                        ? invoice.getCurrency()
                        : (store.getCurrency() != null ? store.getCurrency() : "PKR");

        return new InvoiceSummaryDto(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                orderNumber,
                total,
                invoice.getIssuedAt(),
                currency
        );
    }
}


