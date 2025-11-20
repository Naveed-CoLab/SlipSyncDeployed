package com.slipsync.Repositories;

import com.slipsync.Entities.PrintDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrintDeviceRepository extends JpaRepository<PrintDevice, UUID> {
    Optional<PrintDevice> findByDeviceIdentifier(String deviceIdentifier);
    List<PrintDevice> findByMerchantId(UUID merchantId);
}