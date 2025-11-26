package com.slipsync.Entities;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "print_jobs")
@Data
public class PrintJob {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "merchant_id")
    private Merchant merchant;

    @ManyToOne
    @JoinColumn(name = "store_id")
    private Store store;

    
    @JoinColumn(name = "print_device_id")
    private String printDeviceId;

    @Column(name = "job_type")
    private String jobType; // receipt, label

    // The actual data the printer needs (e.g., Order JSON)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String payload; 

    @Column(nullable = false)
    private String status = "queued"; // queued, processing, success, failed

    private Integer attempts = 0;
    private String error;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}