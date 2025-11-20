package com.slipsync.Repositories;

import com.slipsync.Entities.Merchant;
import com.slipsync.Entities.Store;
import com.slipsync.Entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

// I'm combining them here for brevity, but usually these are in separate files.
// Spring is smart enough to handle multiple classes in one file if needed,
// but standard practice is separate files. I will generate separate files below
// to ensure strict standard compliance.