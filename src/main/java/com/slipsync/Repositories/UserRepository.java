package com.slipsync.Repositories;

import com.slipsync.Entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByClerkUserId(String clerkUserId);
}