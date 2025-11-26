package com.slipsync.Repositories;

import com.slipsync.Entities.PrintJob;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PrintJobRepository extends JpaRepository<PrintJob, UUID> {
    // Find jobs meant for a specific device (or any device in the store) that are queued
    // For MVP, we'll just fetch all queued jobs for the store/merchant
    List<PrintJob> findByPrintDeviceIdAndStatus(String deviceIdentifier, String status);


}