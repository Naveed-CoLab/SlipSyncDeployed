package com.slipsync.Entities;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "merchants")
@Data
public class Merchant {

    /**
     * Primary key is now the Clerk organization id (e.g. org_35kd0au4TlJlAqCgWuBeVOmVYcN).
     * The database column type should be text/varchar.
     */
    @Id
    @Column(name = "id", nullable = false, updatable = false, unique = true)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "currency")
    private String currency = "PKR";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}