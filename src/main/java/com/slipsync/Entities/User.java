package com.slipsync.Entities;

import jakarta.persistence.*;
import lombok.Data; // Using Lombok for getters/setters
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users") // Maps to your SQL 'users' table
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "clerk_user_id", unique = true, nullable = false)
    private String clerkUserId;

    private String email;
    
    @Column(name = "full_name")
    private String fullName;

    // Foreign Key to Merchant
    @ManyToOne
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    // Foreign Key to Role (defines user permissions)
    @ManyToOne
    @JoinColumn(name = "role_id")
    private Role role;

    // Foreign Key to Store (if user is assigned to specific store)
    // Note: This field is NOT in the actual DB schema, but kept for backward compatibility
    // with existing controllers. Should be removed once controllers are refactored.
    @Transient
    private Store store;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}