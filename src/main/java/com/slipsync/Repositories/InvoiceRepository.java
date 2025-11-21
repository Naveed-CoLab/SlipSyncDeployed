package com.slipsync.Repositories;

import com.slipsync.Entities.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findTop10ByStoreIdOrderByIssuedAtDesc(UUID storeId);
}