-- ===================================================
-- HS LIBRARY — Multi-Library MySQL Database Schema
-- Database: hs_library
-- Compatible with MySQL 8.0+ and MySQL Workbench
-- ===================================================

CREATE DATABASE IF NOT EXISTS hs_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hs_library;

-- 1. Libraries Table (Multi-tenant foundation)
CREATE TABLE IF NOT EXISTS libraries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_libraries_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Librarians / Users Table
CREATE TABLE IF NOT EXISTS librarians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    library_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'librarian',
    reset_token_hash VARCHAR(255) DEFAULT NULL,
    reset_token_expires DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_librarians_library FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    INDEX idx_librarians_email (email),
    INDEX idx_librarians_library (library_id),
    INDEX idx_librarians_reset_token (reset_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Books Table (Scoped to Library)
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    library_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    isbn VARCHAR(50) DEFAULT NULL,
    shelf VARCHAR(50) DEFAULT 'Main Stack A-1',
    publication_year INT DEFAULT 2023,
    cover_image TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    status ENUM('available', 'issued') NOT NULL DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_books_library FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    INDEX idx_books_library (library_id),
    INDEX idx_books_status (library_id, status),
    INDEX idx_books_category (library_id, category),
    INDEX idx_books_language (library_id, language),
    INDEX idx_books_title (library_id, title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Students Table (Scoped to Library)
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    library_id INT NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    department VARCHAR(100) DEFAULT 'Computer Science',
    phone VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_library FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_per_library UNIQUE (library_id, student_id),
    INDEX idx_students_library (library_id),
    INDEX idx_students_name (library_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Issues / Circulation Table (Scoped to Library)
CREATE TABLE IF NOT EXISTS issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    library_id INT NOT NULL,
    book_id INT NOT NULL,
    student_id INT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    status ENUM('issued', 'returned', 'overdue') NOT NULL DEFAULT 'issued',
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_issues_library FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    CONSTRAINT fk_issues_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
    CONSTRAINT fk_issues_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
    INDEX idx_issues_library (library_id),
    INDEX idx_issues_status (library_id, status),
    INDEX idx_issues_dates (library_id, issue_date, due_date, return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bug Tracker Table (TQM Q09: Reduce Bugs)
CREATE TABLE IF NOT EXISTS bugs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    library_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    module VARCHAR(100) NOT NULL,
    steps_to_reproduce TEXT DEFAULT NULL,
    expected_result TEXT DEFAULT NULL,
    actual_result TEXT DEFAULT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
    status VARCHAR(20) NOT NULL DEFAULT 'Open',
    reported_by VARCHAR(255) DEFAULT 'Librarian',
    assigned_to VARCHAR(255) DEFAULT NULL,
    fix_details TEXT DEFAULT NULL,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bugs_library FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    INDEX idx_bugs_library (library_id),
    INDEX idx_bugs_status (library_id, status),
    INDEX idx_bugs_severity (library_id, severity),
    INDEX idx_bugs_module (library_id, module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Automated Test Runs Table (TQM Evidence & Quality Tracking)
CREATE TABLE IF NOT EXISTS test_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_tests INT NOT NULL DEFAULT 0,
    passed_tests INT NOT NULL DEFAULT 0,
    failed_tests INT NOT NULL DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    summary_json TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_test_runs_date (run_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- INITIAL DEFAULT SEED DATA (Library 1: HS Central Library)
-- ===================================================

INSERT IGNORE INTO libraries (id, name) VALUES
(1, 'HS Central Library');

-- Default librarian for Library 1 (Password: Admin@123)
-- Hash generated via bcrypt (cost factor 10)
INSERT IGNORE INTO librarians (id, library_id, name, email, password_hash, phone, role) VALUES
(1, 1, 'Head Librarian', 'librarian@hslibrary.edu', '$2a$10$wK1Ww6Hq6UaT.n5s6C9Yle9H7j7.wDcfzL9Oq9UqH4x2B6V3l0BvG', '+91 98765 00000', 'admin');

INSERT IGNORE INTO books (id, library_id, title, author, category, isbn, shelf, publication_year, status) VALUES
(1, 1, 'Clean Architecture: A Craftsman''s Guide', 'Robert C. Martin', 'Computer Science', '978-0134494166', 'CS-101', 2017, 'issued'),
(2, 1, 'Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma, Richard Helm', 'Computer Science', '978-0201633610', 'CS-102', 1994, 'available'),
(3, 1, 'Introduction to Algorithms (CLRS)', 'Thomas H. Cormen', 'Algorithms', '978-0262033848', 'AL-201', 2009, 'available'),
(4, 1, 'The Pragmatic Programmer', 'David Thomas, Andrew Hunt', 'Software Engineering', '978-0135957059', 'SE-301', 2019, 'available'),
(5, 1, 'Artificial Intelligence: A Modern Approach', 'Stuart Russell, Peter Norvig', 'Artificial Intelligence', '978-0136042594', 'AI-401', 2020, 'issued'),
(6, 1, 'Database System Concepts', 'Abraham Silberschatz', 'Databases', '978-0078022159', 'DB-105', 2019, 'available'),
(7, 1, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Distributed Systems', '978-1449373320', 'DS-501', 2017, 'available'),
(8, 1, 'Computer Networking: A Top-Down Approach', 'James F. Kurose, Keith W. Ross', 'Networking', '978-0133594140', 'NET-202', 2021, 'available');

INSERT IGNORE INTO students (id, library_id, student_id, name, email, department, phone) VALUES
(1, 1, 'HS-2024-001', 'Anushka Puri', 'anushka.puri@hslibrary.edu', 'Computer Science', '+91 98765 43210'),
(2, 1, 'HS-2024-002', 'Rohan Sharma', 'rohan.sharma@hslibrary.edu', 'Information Technology', '+91 98111 22334'),
(3, 1, 'HS-2024-003', 'Priya Patel', 'priya.patel@hslibrary.edu', 'Data Science', '+91 98222 33445'),
(4, 1, 'HS-2024-004', 'Aarav Mehta', 'aarav.mehta@hslibrary.edu', 'Artificial Intelligence', '+91 98333 44556'),
(5, 1, 'HS-2024-005', 'Sneha Iyer', 'sneha.iyer@hslibrary.edu', 'Cybersecurity', '+91 98444 55667');

INSERT IGNORE INTO issues (id, library_id, book_id, student_id, issue_date, due_date, return_date, status, remarks) VALUES
(1, 1, 1, 1, DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL, 'overdue', 'First renewal requested'),
(2, 1, 5, 2, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), NULL, 'issued', 'Standard 14-day checkout'),
(3, 1, 2, 3, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'returned', 'Returned on time in pristine condition'),
(4, 1, 4, 4, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY), 'returned', 'Completed coursework reading');
