package com.slipsync.Controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.slipsync.Entities.*;
import com.slipsync.Repositories.*;
import com.slipsync.Services.StoreContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PrintingController {

    private final PrintDeviceRepository deviceRepository;
    private final PrintJobRepository jobRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final StoreContextService storeContextService;
    private final ObjectMapper objectMapper; // To convert Order to JSON payload

    public PrintingController(PrintDeviceRepository deviceRepository,
            PrintJobRepository jobRepository,
            UserRepository userRepository,
            OrderRepository orderRepository,
            ObjectMapper objectMapper,
            StoreContextService storeContextService) {
        this.deviceRepository = deviceRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
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

    // --- 1. HEARTBEAT (Called by Local Agent) ---
    // Note: Ideally, the Agent should have its own API Key.
    // For MVP, we'll assume the Agent sends the User's JWT (Owner is logged in on
    // the PC).
    @PostMapping("/print-devices/heartbeat")
    public ResponseEntity<?> heartbeat(HttpServletRequest request, @RequestBody Map<String, String> payload) {

        String deviceIdentifier = payload.get("deviceIdentifier");
        String deviceName = payload.getOrDefault("name", "Local POS Terminal");

        PrintDevice device = deviceRepository.findByDeviceIdentifier(deviceIdentifier).orElse(null);

        if (device != null) {
            // New Device
            device.setLastSeen(LocalDateTime.now());
        }

        return ResponseEntity.ok(deviceRepository.save(device));
    }

    @PostMapping("/print-devices/register")
    public ResponseEntity<?> registerDevice(HttpServletRequest request, @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized User");

        String deviceIdentifier = payload.get("deviceIdentifier");
        String deviceName = payload.getOrDefault("name", "POS Terminal");

        PrintDevice device = deviceRepository.findByDeviceIdentifier(deviceIdentifier)
                .orElse(new PrintDevice());

        // Generate a new long-lived secret if one doesn't exist
        if (device.getApiSecret() == null) {
            device.setApiSecret(UUID.randomUUID().toString());
        }

        device.setDeviceIdentifier(deviceIdentifier);
        device.setMerchant(user.getMerchant()); // Link to this user's merchant
        device.setName(deviceName);
        device.setLastSeen(LocalDateTime.now());

        deviceRepository.save(device);

        // Return the secret to the agent
        Map<String, String> response = new HashMap<>();
        response.put("status", "registered");
        response.put("deviceSecret", device.getApiSecret());
        response.put("merchantId", user.getMerchant().getId().toString());

        return ResponseEntity.ok(response);
    }

    // --- 2. CHECK STATUS (Called by React Frontend) ---
    @GetMapping("/print-devices/status")
    public ResponseEntity<?> getStatus(HttpServletRequest request) {
        User user = getCurrentUser(request);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        List<PrintDevice> devices = deviceRepository.findByMerchantId(user.getMerchant().getId());

        Map<String, Object> response = new HashMap<>();       
        // Build a list of device info objects (name + lastSeen) to return to the client
        java.util.List<Map<String, Object>> deviceList = new java.util.ArrayList<>();
        for (PrintDevice d : devices) {
            if (d.getLastSeen() != null && ChronoUnit.SECONDS.between(d.getLastSeen(), LocalDateTime.now()) < 10) {
                Map<String, Object> dev = new HashMap<>();
                dev.put("name", d.getName());
                dev.put("deviceIdentifier", d.getApiSecret());
                dev.put("lastSeen", d.getLastSeen());
                deviceList.add(dev);
            }
        }
        response.put("devices", deviceList);

        return ResponseEntity.ok(response);
    }

    // --- 3. CREATE JOB (Called by React Frontend) ---
    @PostMapping("/print-jobs/{orderId}")
    public ResponseEntity<?> createPrintJob(HttpServletRequest request, @PathVariable UUID orderId,
            @RequestBody Map<String, String> payload) {
        User user = getCurrentUser(request);
        String deviceIdentifier = payload.get("deviceIdentifier");
        System.out.println("deviceIdentifier of selected device:" + deviceIdentifier);
        if (user == null || deviceIdentifier == null)
            return ResponseEntity.status(401).body("Unauthorized");

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null)
            return ResponseEntity.status(404).body("Order not found");

        try {
            PrintJob job = new PrintJob();
            job.setPrintDeviceId(deviceIdentifier);
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
        String deviceSecret = request.getHeader("X-Device-Secret");

        // Fetch all queued jobs for this store
        List<PrintJob> jobs = jobRepository.findByPrintDeviceIdAndStatus(deviceSecret, "queued");
        System.out.println("jobs size:"+jobs.size());
        // In a real app, you might mark them as 'processing' here to avoid double
        // printing
        return ResponseEntity.ok(jobs);
    }

    // --- 5. JOB RESPONSE (Called by Local Agent) ---
    @PostMapping("/print-jobs/{jobId}/response")
    public ResponseEntity<?> updateJobStatus(HttpServletRequest request, @PathVariable UUID jobId,
            @RequestBody Map<String, String> payload) {
       
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