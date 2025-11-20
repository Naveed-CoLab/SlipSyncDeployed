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

    // Foreign Key to Store (nullable, as an admin might oversee all)
    @ManyToOne
    @JoinColumn(name = "store_id")
    private Store store;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}