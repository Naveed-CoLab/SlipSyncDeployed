package com.slipsync.Entities;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "customers")
@Data
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(name = "name")
    private String name;

    private String phone;
    private String email;

    // "metadata" is JSONB in Postgres. For simplicity in JPA, we map it as a String
    // or you can use a custom converter / library like 'hibernate-types' for real JSON support.
    // For now, we'll leave it out or treat it as a String if needed, 
    // but standard JPA doesn't support JSONB out of the box without extra deps.
    // I will skip it for the MVP to keep things simple.

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}