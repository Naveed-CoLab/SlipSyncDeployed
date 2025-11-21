package com.slipsync.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record InvoiceSummaryDto(
        UUID id,
        String invoiceNumber,
        String orderNumber,
        BigDecimal total,
        LocalDateTime issuedAt,
        String currency) {
}


