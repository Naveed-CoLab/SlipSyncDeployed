package com.slipsync.Configuration;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.slipsync.Security.ClerkAuthFilter;

@Configuration
public class FilterConfig {
    @Bean
    public FilterRegistrationBean<ClerkAuthFilter> clerkFilter(ClerkAuthFilter filter) {
        FilterRegistrationBean<ClerkAuthFilter> fr = new FilterRegistrationBean<>();
        fr.setFilter(filter);
        fr.addUrlPatterns("/api/*"); // protect all /api/* endpoints
        fr.setOrder(1);
        return fr;
    }
}
