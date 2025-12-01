package com.slipsync.agent;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.util.*;

@SpringBootApplication
@EnableScheduling
public class AgentApplication implements CommandLineRunner {

    private static final String CONFIG_FILE = "agent-config.properties";

    private String backendUrl;
    private String deviceSecret; // Long-lived key
    private String deviceId;
    private String deviceName;

    private final RestTemplate restTemplate;

    public AgentApplication(RestTemplateBuilder builder) {
        this.restTemplate = builder.build();
    }

    public static void main(String[] args) {
        SpringApplication.run(AgentApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        loadConfig();

        // If we don't have a secret, we need to register (One-time setup)
        if (this.deviceSecret == null || this.deviceSecret.isEmpty()) {
            runSetupWizard();
        } else {
            System.out.println("✅ Agent Loaded with Device Secret.");
        }

        System.out.println("🚀 Agent is running (ID: " + this.deviceId + ")");
        sendHeartbeat();
    }

    // --- ONE-TIME SETUP WIZARD ---
    private void runSetupWizard() {
        Scanner scanner = new Scanner(System.in);
        System.out.println("=== SlipSync Agent Setup ===");

        this.backendUrl = "https://slipsyncdeployed.onrender.com/api";

        System.out.println("\nPaste your Clerk Token (from Frontend) to pair this device:");
        String tempToken = scanner.nextLine().trim();

        System.out.println("\nEnter the name of this device:");
         deviceName = scanner.nextLine().trim();

        if (tempToken.isEmpty()) {
            System.err.println("Token required.");
            System.exit(1);
        }

        if (deviceName.isEmpty()) {
            System.err.println("Name is required.");
            System.exit(1);
        }
        // Exchange Token for Secret
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(tempToken); // Use Token just once
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> body = Map.of(
                    "deviceIdentifier", this.deviceId,
                    "name", this.deviceName);

            System.out.print("Pairing with backend... ");
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    backendUrl + "/print-devices/register",
                    new HttpEntity<>(body, headers),
                    Map.class);

            Map<String, String> respBody = response.getBody();
            this.deviceSecret = respBody.get("deviceSecret"); // GET THE SECRET

            saveConfig(); // Save secret to file
            System.out.println("SUCCESS! Device Paired.");

        } catch (Exception e) {
            System.err.println("FAILED: " + e.getMessage());
            System.exit(1);
        }
    }

    // --- PERSISTENT LOOP (Uses Secret) ---

    @Scheduled(fixedRate = 5000)
    public void loop() {
        if (deviceSecret == null)
            return;
        try {
            pollForJobs();
        } catch (Exception e) {
            /* ignore connection errors */ }
    }

    @Scheduled(fixedRate = 30000)
    public void heartbeatLoop() {
        if (deviceSecret == null)
            return;
        try {
            sendHeartbeat();
        } catch (Exception e) {
            /* ignore */ }
    }

    // --- API CALLS (Using X-Device-Secret) ---

    private void sendHeartbeat() {
        // Note: Heartbeat needs to update 'last_seen', but 'register' endpoint handles
        // full update.
        // Ideally, we have a heartbeat endpoint that accepts the secret.
        // Reuse register logic or separate endpoint.
        // For MVP, let's assume the register endpoint also works as heartbeat if we
        // send the secret?
        // Actually, let's use the standard heartbeat endpoint but use the SECRET
        // header.
        System.out.println("Sending heartbeat");
        HttpHeaders headers = getDeviceHeaders();
        Map<String, String> body = Map.of("deviceIdentifier", deviceId);

        restTemplate.postForEntity(
                backendUrl + "/print-devices/heartbeat",
                new HttpEntity<>(body, headers),
                String.class);
    }

    private void pollForJobs() {
        System.out.println("Polling for jobs");
        HttpHeaders headers = getDeviceHeaders();
        ResponseEntity<List> response = restTemplate.exchange(
                backendUrl + "/print-jobs/pending",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                List.class);

        List<Map<String, Object>> jobs = response.getBody();
        if (jobs != null && !jobs.isEmpty()) {
            System.out.println("📦 Found jobs: " + jobs.size());
            for (Map<String, Object> job : jobs) {
                processJob(job);
            }
        }
    }

    private void processJob(Map<String, Object> job) {
        // ... (Same printing logic as before) ...
        String jobId = (String) job.get("id");
        System.out.println("Printing Job: " + jobId);
        
        System.out.println("payload:"+(String) job.get("payload"));
        // ... write to file ...

        // Send Response
        HttpHeaders headers = getDeviceHeaders();
        Map<String, String> body = Map.of("status", "success");
        restTemplate.postForEntity(
                backendUrl + "/print-jobs/" + jobId + "/response",
                new HttpEntity<>(body, headers),
                String.class);
    }

    private HttpHeaders getDeviceHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Device-Secret", this.deviceSecret); // THE KEY CHANGE
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // ... loadConfig/saveConfig implementation (same as before) ...
    private void loadConfig() {
        Properties props = new Properties();
        File file = new File(CONFIG_FILE);
        if (file.exists()) {
            try (FileInputStream in = new FileInputStream(file)) {
                props.load(in);
                this.backendUrl = props.getProperty("backendUrl", "https://slipsyncdeployed.onrender.com/api");
                this.deviceSecret = props.getProperty("deviceSecret");
                this.deviceId = props.getProperty("deviceId");
                this.deviceName = props.getProperty("deviceName");
            } catch (IOException e) {
            }
        }
        if (this.deviceId == null) {
            this.deviceId = "agent-" + UUID.randomUUID().toString();
            saveConfig();
        }
    }

    private void saveConfig() {
        Properties props = new Properties();

        if (backendUrl != null)
            props.setProperty("backendUrl", backendUrl);

        if (deviceSecret != null && !deviceSecret.isEmpty())
            props.setProperty("deviceSecret", deviceSecret);

        if (deviceId != null)
            props.setProperty("deviceId", deviceId);
        
        if (deviceName != null)
            props.setProperty("deviceName", deviceName);

        try (FileOutputStream out = new FileOutputStream(CONFIG_FILE)) {
            props.store(out, null);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

}