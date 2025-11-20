package com.slipsync.Configuration;

import com.clerk.backend_api.Clerk;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClerkSdkConfig {

    // --- CHANGE THIS ---
    // Read from the same property as your filter
    @Value("${clerk.secret.key:${CLERK_SECRET_KEY:}}")
    private String secretKey; // Renamed variable

    @Value("${clerk.server.url:https://api.clerk.com/v1}")
    private String serverUrl;

    @Bean
    public Clerk clerkSdk() {
        Clerk.Builder builder = Clerk.builder();
        
        // --- CHANGE THIS ---
        System.out.println("secret key = "+secretKey);
        if (secretKey != null && !secretKey.isBlank()) {
            builder.bearerAuth(secretKey); // Use the renamed variable
        }
        
        // optional: override server URL
        if (serverUrl != null && !serverUrl.isBlank()) {
            builder.serverURL(serverUrl);
        }
        
        // enable HTTP debug logs in development only (do not enable in prod)
        // builder.enableHTTPDebugLogging(true);

        return builder.build();
    }
}