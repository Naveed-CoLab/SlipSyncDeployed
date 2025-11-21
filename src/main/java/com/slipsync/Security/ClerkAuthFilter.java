package com.slipsync.Security;

import com.clerk.backend_api.helpers.security.AuthenticateRequest;
import com.clerk.backend_api.helpers.security.models.AuthenticateRequestOptions;
import com.clerk.backend_api.helpers.security.models.RequestState;
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

@Component
public class ClerkAuthFilter implements Filter {

    @Value("${clerk.secret.key:${CLERK_SECRET_KEY}}")
    private String clerkSecretKey;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        // --- Basic CORS handling so that even error responses include the header ---
        String origin = request.getHeader("Origin");
        if (origin != null && origin.equals("http://localhost:5173")) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Vary", "Origin");
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Headers", "Authorization, X-Clerk-Org-Id, X-Clerk-Org-Role, X-Clerk-Store-Access, X-Store-Id, x-store-id, Content-Type");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        }

        // Allow CORS preflight requests to pass through without auth
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            System.out.println("❌ AUTH FAILED: Missing or invalid Authorization header");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("text/plain");
            response.getWriter().write("Missing Authorization header");
            return;
        }
        
        String token = authHeader.substring(7);
        System.out.println("🔑 Validating token (first 20 chars): " + token.substring(0, Math.min(20, token.length())));
        
        // TEMPORARY FIX FOR DEVELOPMENT: Skip token validation if clock skew issues
        // In production, make sure your server time is synchronized
        boolean skipValidation = System.getProperty("clerk.skip.validation", "false").equals("true");
        
        if (skipValidation) {
            System.out.println("⚠️  WARNING: Token validation skipped (development mode only)");
            // Extract user ID from token without validation (UNSAFE - development only)
            try {
                String[] parts = token.split("\\.");
                if (parts.length >= 2) {
                    String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
                    // This is a very basic extraction - just for development
                    if (payload.contains("\"sub\":\"")) {
                        int start = payload.indexOf("\"sub\":\"") + 7;
                        int end = payload.indexOf("\"", start);
                        String userId = payload.substring(start, end);
                        System.out.println("✅ AUTH BYPASSED (DEV MODE): User ID = " + userId);
                        request.setAttribute("clerk.userId", userId);
                        chain.doFilter(request, response);
                        return;
                    }
                }
            } catch (Exception e) {
                System.out.println("❌ Failed to extract user ID from token: " + e.getMessage());
            }
        }
        
        try {
            AuthenticateRequestOptions options = AuthenticateRequestOptions
                    .secretKey(clerkSecretKey)
                    .build();

            Map<String, List<String>> headers = Collections.singletonMap("authorization", List.of("Bearer " + token));
            RequestState state = AuthenticateRequest.authenticateRequest(headers, options);

            if (!state.isSignedIn()) {
                String reason = Optional.ofNullable(state.reason()).map(Object::toString).orElse("Unauthenticated");
                System.out.println("❌ AUTH FAILED: Clerk rejected token. Reason: " + reason);
                System.out.println("💡 TIP: If you see TOKEN_NOT_ACTIVE_YET or TOKEN_IAT_IN_THE_FUTURE, your system clock may be incorrect.");
                System.out.println("💡 Run: w32tm /resync to sync your Windows time, or start with -Dclerk.skip.validation=true for development");
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("text/plain");
                response.getWriter().write("Clerk auth failed: " + reason + ". Check server logs for details.");
                return;
            }
            
            String userId = state.claims().map(c -> c.getSubject()).orElse("unknown");
            System.out.println("✅ AUTH SUCCESS: User ID = " + userId);

            request.setAttribute("clerk.requestState", state);
            request.setAttribute("clerk.userId", userId);

            chain.doFilter(request, response);
        } catch (Exception e) {
            System.out.println("❌ AUTH EXCEPTION: " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("text/plain");
            response.getWriter().write("Clerk auth error: " + e.getMessage());
        }
    }
}
