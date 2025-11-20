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

    // optional: restrict allowed token types, e.g. oauth_token for M2M
    // private List<String> accepts = Collections.singletonList("id_token");

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing Authorization header");
            return;
        }
        System.out.println("secret key = "+clerkSecretKey);
        
        String token = authHeader.substring(7);
        try {
            AuthenticateRequestOptions options = AuthenticateRequestOptions
                    .secretKey(clerkSecretKey)
                    // .acceptsTokens(accepts) // uncomment to restrict token types
                    .build();

            RequestState state;
            // the SDK helper can work with a map of headers; provide the Authorization header with the token
            try {
                Map<String, List<String>> headers = Collections.singletonMap("authorization", List.of("Bearer " + token));
                state = AuthenticateRequest.authenticateRequest(headers, options);
            } catch (Exception ex) {
                throw ex;
            }

            if (!state.isSignedIn()) {
                String reason = Optional.ofNullable(state.reason()).map(Object::toString).orElse("Unauthenticated");
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Clerk auth failed: " + reason);
                return;
            }

            // Attach user id and full claims to the request for controllers and services:
            request.setAttribute("clerk.requestState", state);
            // claims() returns Optional<Claims> so extract subject safely
            request.setAttribute("clerk.userId", state.claims().map(c -> c.getSubject()).orElse(null)); // subject is typically user id

            chain.doFilter(request, response);
        } catch (Exception e) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Clerk auth error: " + e.getMessage());
        }
    }
}
