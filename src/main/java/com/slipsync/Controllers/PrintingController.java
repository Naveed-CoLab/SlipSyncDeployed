package com.slipsync.Controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PrintingController {

    private final PrintDeviceRepository deviceRepository;
    private final PrintJobRepository jobRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper; // To convert Order to JSON payload

    public PrintingController(PrintDeviceRepository deviceRepository,
                              PrintJobRepository jobRepository,
                              UserRepository userRepository,
                              OrderRepository orderRepository,
                              ObjectMapper objectMapper) {
        this.deviceRepository = deviceRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
    }

    private User getCurrentUser(HttpServletRequest request) {
        String clerkId = (String) request.getAttribute("clerk.userId");
        return userRepository.findByClerkUserId(clerkId).orElse(null);
    }

    // --- 1. HEARTBEAT (Called by Local Agent) ---
    // Note: Ideally, the Agent should have its own API Key. 
    // For MVP, we'll assume the Agent sends the User's JWT (Owner is logged in on the PC).
    @PostMapping("/print-devices/heartbeat")
    public ResponseEntity<?> heartbeat(HttpServletRequest request, @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        String deviceIdentifier = payload.get("deviceIdentifier");
        String deviceName = payload.getOrDefault("name", "Local POS Terminal");

        PrintDevice device = deviceRepository.findByDeviceIdentifier(deviceIdentifier)
                .orElse(new PrintDevice());

        if (device.getId() == null) {
            // New Device
            device.setDeviceIdentifier(deviceIdentifier);
            device.setMerchant(user.getMerchant());
            device.setName(deviceName);
        }
        
        device.setLastSeen(LocalDateTime.now());
        return ResponseEntity.ok(deviceRepository.save(device));
    }

    // --- 2. CHECK STATUS (Called by React Frontend) ---
    @GetMapping("/print-devices/status")
    public ResponseEntity<?> getStatus(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<PrintDevice> devices = deviceRepository.findByMerchantId(user.getMerchant().getId());
        
        boolean isOnline = devices.stream().anyMatch(d -> 
            d.getLastSeen() != null && 
            ChronoUnit.SECONDS.between(d.getLastSeen(), LocalDateTime.now()) < 60
        );

        Map<String, Object> response = new HashMap<>();
        response.put("status", isOnline ? "ONLINE" : "OFFLINE");
        response.put("activeDevices", devices.size());
        
        return ResponseEntity.ok(response);
    }

    // --- 3. CREATE JOB (Called by React Frontend) ---
    @PostMapping("/print-jobs/{orderId}")
    public ResponseEntity<?> createPrintJob(HttpServletRequest request, @PathVariable UUID orderId) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return ResponseEntity.status(404).body("Order not found");

        try {
            PrintJob job = new PrintJob();
            job.setMerchant(user.getMerchant());
            job.setStore(user.getStore()); // Job is for THIS store
            job.setJobType("receipt");
            job.setStatus("queued");
            
            // Serialize the Order object to JSON string for the payload
            // The Agent will download this JSON and print it
            String orderJson = objectMapper.writeValueAsString(order);
            job.setPayload(orderJson);

            return ResponseEntity.ok(jobRepository.save(job));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to queue print job: " + e.getMessage());
        }
    }

    // --- 4. POLL FOR JOBS (Called by Local Agent) ---
    @GetMapping("/print-jobs/pending")
    public ResponseEntity<?> getPendingJobs(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (user.getStore() == null) return ResponseEntity.ok(List.of());

        // Fetch all queued jobs for this store
        List<PrintJob> jobs = jobRepository.findByStoreIdAndStatus(user.getStore().getId(), "queued");
        
        // In a real app, you might mark them as 'processing' here to avoid double printing
        return ResponseEntity.ok(jobs);
    }

    // --- 5. JOB RESPONSE (Called by Local Agent) ---
    @PostMapping("/print-jobs/{jobId}/response")
    public ResponseEntity<?> updateJobStatus(HttpServletRequest request, @PathVariable UUID jobId, @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request); // Verify agent has access
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        return jobRepository.findById(jobId).map(job -> {
            job.setStatus(payload.get("status")); // "success" or "failed"
            job.setError(payload.get("error"));
            if ("success".equalsIgnoreCase(payload.get("status"))) {
                job.setCompletedAt(LocalDateTime.now());
            }
            return ResponseEntity.ok(jobRepository.save(job));
        }).orElse(ResponseEntity.notFound().build());
    }
}