package com.slipsync.Security;

import com.clerk.backend_api.helpers.security.AuthenticateRequest;
import com.clerk.backend_api.helpers.security.models.AuthenticateRequestOptions;
import com.clerk.backend_api.helpers.security.models.RequestState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ClerkAuthService {

    @Value("${clerk.secret.key:${CLERK_SECRET_KEY:}}")
    private String clerkSecretKey;

    /**
     * Validate an incoming HttpRequest (Java's HttpRequest used by the SDK helper).
     * We'll provide a small wrapper to feed the helper since our web layer has HttpServletRequest.
     */
    public RequestState authenticate(java.net.http.HttpRequest request, String authorizedParty) {
        AuthenticateRequestOptions.Builder opts = AuthenticateRequestOptions
                .secretKey(clerkSecretKey);

        if (authorizedParty != null && !authorizedParty.isBlank()) {
            opts.authorizedParty(authorizedParty);
        }
        Map<String, List<String>> headers = request.headers().map();
        return AuthenticateRequest.authenticateRequest(headers, opts.build());
    }
}
