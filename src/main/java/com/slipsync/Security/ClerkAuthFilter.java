package com.slipsync.Security;

import com.clerk.backend_api.helpers.security.AuthenticateRequest;
import com.clerk.backend_api.helpers.security.models.AuthenticateRequestOptions;
import com.clerk.backend_api.helpers.security.models.RequestState;
import com.slipsync.Entities.PrintDevice;
import com.slipsync.Repositories.PrintDeviceRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class ClerkAuthFilter implements Filter {

    @Value("${clerk.secret.key:${CLERK_SECRET_KEY}}")
    private String clerkSecretKey;

    private final PrintDeviceRepository deviceRepository;

    public ClerkAuthFilter(PrintDeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        // ---------------------------------------------------------
        // 1. CORS & OPTIONS HANDLING (Crucial for Frontend)
        // ---------------------------------------------------------
        String origin = request.getHeader("Origin");
        // You might want to make this dynamic or allow all for dev
        if (origin != null && (origin.equals("http://localhost:5173") || origin.equals("http://localhost:3000"))) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Vary", "Origin");
            response.setHeader("Access-Control-Allow-Credentials", "true");
            // Added X-Device-Secret to allowed headers
            response.setHeader("Access-Control-Allow-Headers",
                    "Authorization, X-Clerk-Org-Id, X-Clerk-Org-Role, X-Clerk-Store-Access, X-Store-Id, x-store-id, X-Device-Secret, Content-Type");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        // ---------------------------------------------------------
        // 2. AGENT AUTHENTICATION (X-Device-Secret)
        // ---------------------------------------------------------
        String deviceSecret = request.getHeader("X-Device-Secret");
        if (deviceSecret != null) {
            // Note: Using findBySecretApi as discussed for "Ultimate Security"
            // If you haven't updated repo yet, use findById/findAll logic
            Optional<PrintDevice> device = deviceRepository.findByApiSecret(deviceSecret);
            System.out.println("This is request with agent key. secret key: "+deviceSecret);

            if (device.isPresent()) {
                request.setAttribute("authType", "DEVICE");
                request.setAttribute("merchant.id", device.get().getMerchant().getId());
                chain.doFilter(request, response);
                return;
            } else {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid Device Secret");
                return;
            }
        }

        // ---------------------------------------------------------
        // 3. USER AUTHENTICATION (Clerk Token)
        // ---------------------------------------------------------
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // Only reject if NO auth method was present
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing Authorization header");
            return;
        }
        System.out.println("This is request with auth key ");

        String token = authHeader.substring(7);

        // Optional: Dev mode bypass logic here if needed (skipped for brevity)

        try {
            AuthenticateRequestOptions options = AuthenticateRequestOptions
                    .secretKey(clerkSecretKey)
                    .build();

            Map<String, List<String>> headers = Collections.singletonMap("authorization", List.of("Bearer " + token));
            RequestState state = AuthenticateRequest.authenticateRequest(headers, options);

            if (state.isSignedIn()) {
                String userId = state.claims().map(c -> c.getSubject()).orElse(null);
                request.setAttribute("clerk.userId", userId);
                request.setAttribute("clerk.requestState", state);
                chain.doFilter(request, response);
                return;
            }
        } catch (Exception e) {
            System.err.println("Clerk Auth Error: " + e.getMessage());
        }

        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid User Token");
    }
}