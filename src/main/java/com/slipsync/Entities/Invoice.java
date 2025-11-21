package com.slipsync.Entities;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoices")
@Data
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne
    @JoinColumn(name = "merchant_id")
    private Merchant merchant;

    @ManyToOne
    @JoinColumn(name = "store_id")
    private Store store;

    @Column(name = "invoice_number", unique = true)
    private String invoiceNumber;

    @Column(name = "issued_at")
    @CreationTimestamp
    private LocalDateTime issuedAt;

    private BigDecimal total;

    @Column(name = "currency")
    private String currency = "PKR";

    @Column(name = "pdf_url")
    private String pdfUrl; // For future E-Bill PDF link
}