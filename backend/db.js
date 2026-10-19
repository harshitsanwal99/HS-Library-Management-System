const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { CURATED_BOOKS, TECH_BOOK_COVERS } = require('./curatedBooks');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let mysqlPool = null;
let sqliteDb = null;
let activeDbType = null;
let dbStatusMessage = '';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'hs_library';

/**
 * Initialize database connection and run safe multi-library migrations
 */
async function initDatabase() {
    // 1. Attempt MySQL connection
    try {
        const mysql = require('mysql2/promise');
        const testConn = await mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            connectTimeout: 2000
        });

        await testConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await testConn.end();

        mysqlPool = mysql.createPool({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        activeDbType = 'mysql';
        dbStatusMessage = `Connected to MySQL database [${DB_NAME}] on ${DB_HOST}:${DB_PORT}`;
        console.log(`[HS Library DB] ${dbStatusMessage}`);

        // Ensure multi-tenant MySQL tables and migrations exist
        await runMySQLMigrations();
        return;
    } catch (mysqlErr) {
        console.warn(`[HS Library DB] MySQL not reachable on ${DB_HOST}:${DB_PORT} (${mysqlErr.code || mysqlErr.message}).`);
        console.log(`[HS Library DB] Activating persistent zero-config Relational SQLite engine for zero-downtime operation.`);
    }

    // 2. Fallback to Node.js built-in SQLite engine
    try {
        const { DatabaseSync } = require('node:sqlite');
        const dbPath = path.join(__dirname, `${DB_NAME}.db`);
        sqliteDb = new DatabaseSync(dbPath);
        sqliteDb.exec('PRAGMA foreign_keys = ON;');
        sqliteDb.exec('PRAGMA journal_mode = WAL;');

        activeDbType = 'sqlite';
        dbStatusMessage = `Operating in persistent SQLite mode [${DB_NAME}.db]. Fully persistent and transactional.`;
        console.log(`[HS Library DB] ${dbStatusMessage}`);

        // Ensure multi-tenant SQLite tables and migrations exist
        runSQLiteMigrations();
    } catch (sqliteErr) {
        console.error('[HS Library DB] Fatal: Unable to initialize any database engine:', sqliteErr);
        throw sqliteErr;
    }
}

/**
 * Run safe multi-tenant migrations in MySQL
 */
async function runMySQLMigrations() {
    // 1. Libraries table
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS libraries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_libraries_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Librarians table
    await mysqlPool.query(`
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
    `);

    // Check if librarians has reset_token columns
    const [libCols] = await mysqlPool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'librarians'
    `, [DB_NAME]);
    const libColNames = libCols.map(c => c.COLUMN_NAME);
    if (!libColNames.includes('reset_token_hash')) {
        await mysqlPool.query(`ALTER TABLE librarians ADD COLUMN reset_token_hash VARCHAR(255) DEFAULT NULL AFTER role`);
    }
    if (!libColNames.includes('reset_token_expires')) {
        await mysqlPool.query(`ALTER TABLE librarians ADD COLUMN reset_token_expires DATETIME DEFAULT NULL AFTER reset_token_hash`);
    }

    // 3. Books table
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            library_id INT NOT NULL DEFAULT 1,
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
            INDEX idx_books_library (library_id),
            INDEX idx_books_status (library_id, status),
            INDEX idx_books_language (library_id, language)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if books has library_id, language, cover_image, description columns
    const [bookCols] = await mysqlPool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'books'
    `, [DB_NAME]);
    const colNames = bookCols.map(c => c.COLUMN_NAME);

    if (!colNames.includes('library_id')) {
        await mysqlPool.query(`ALTER TABLE books ADD COLUMN library_id INT NOT NULL DEFAULT 1 AFTER id`);
        await mysqlPool.query(`CREATE INDEX idx_books_library ON books(library_id)`);
    }
    if (!colNames.includes('language')) {
        await mysqlPool.query(`ALTER TABLE books ADD COLUMN language VARCHAR(50) NOT NULL DEFAULT 'English' AFTER category`);
        await mysqlPool.query(`CREATE INDEX idx_books_language ON books(library_id, language)`);
    }
    if (!colNames.includes('cover_image')) {
        await mysqlPool.query(`ALTER TABLE books ADD COLUMN cover_image TEXT DEFAULT NULL AFTER publication_year`);
    }
    if (!colNames.includes('description')) {
        await mysqlPool.query(`ALTER TABLE books ADD COLUMN description TEXT DEFAULT NULL AFTER cover_image`);
    }

    // 4. Students table
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            library_id INT NOT NULL DEFAULT 1,
            student_id VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            department VARCHAR(100) DEFAULT 'Computer Science',
            phone VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_students_library (library_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if students has library_id column
    const [studentCols] = await mysqlPool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'library_id'
    `, [DB_NAME]);
    if (studentCols.length === 0) {
        await mysqlPool.query(`ALTER TABLE students ADD COLUMN library_id INT NOT NULL DEFAULT 1 AFTER id`);
        await mysqlPool.query(`CREATE INDEX idx_students_library ON students(library_id)`);
    }

    // 5. Issues table
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS issues (
            id INT AUTO_INCREMENT PRIMARY KEY,
            library_id INT NOT NULL DEFAULT 1,
            book_id INT NOT NULL,
            student_id INT NOT NULL,
            issue_date DATE NOT NULL,
            due_date DATE NOT NULL,
            return_date DATE DEFAULT NULL,
            status ENUM('issued', 'returned', 'overdue') NOT NULL DEFAULT 'issued',
            remarks TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_issues_library (library_id),
            INDEX idx_issues_status (library_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if issues has library_id column
    const [issueCols] = await mysqlPool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'issues' AND COLUMN_NAME = 'library_id'
    `, [DB_NAME]);
    if (issueCols.length === 0) {
        await mysqlPool.query(`ALTER TABLE issues ADD COLUMN library_id INT NOT NULL DEFAULT 1 AFTER id`);
        await mysqlPool.query(`CREATE INDEX idx_issues_library ON issues(library_id)`);
    }

    // 6. Bug Tracker Table (TQM Q09)
    await mysqlPool.query(`
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
            INDEX idx_bugs_library (library_id),
            INDEX idx_bugs_status (library_id, status),
            INDEX idx_bugs_severity (library_id, severity),
            INDEX idx_bugs_module (library_id, module)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Test Runs Table (TQM Q09)
    await mysqlPool.query(`
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
    `);

    // Seed default library 1 and librarian if empty
    const [libCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM libraries');
    if (libCount[0].count === 0) {
        await mysqlPool.query("INSERT INTO libraries (id, name) VALUES (1, 'HS Central Library')");
        const defaultHash = bcrypt.hashSync('Admin@123', 10);
        await mysqlPool.query(`
            INSERT INTO librarians (id, library_id, name, email, password_hash, phone, role)
            VALUES (1, 1, 'Head Librarian', 'librarian@hslibrary.edu', ?, '+91 98765 00000', 'admin')
        `, [defaultHash]);
    }

    // Check if initial books exist; seed only if completely empty
    const [bookCount] = await mysqlPool.query('SELECT COUNT(*) as count FROM books');
    if (bookCount[0].count === 0) {
        console.log('[HS Library DB] Seeding initial books for Library 1 into MySQL...');
        await seedInitialDataMySQL();
    }
    // Seed and sync curated collection (idempotent, safe)
    await seedCuratedBooksMySQL(1);
}

/**
 * Run safe multi-tenant migrations in SQLite
 */
function runSQLiteMigrations() {
    // 1. Libraries table
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS libraries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_libraries_name ON libraries(name);

        CREATE TABLE IF NOT EXISTS librarians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            library_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            phone TEXT DEFAULT NULL,
            role TEXT DEFAULT 'librarian',
            reset_token_hash TEXT DEFAULT NULL,
            reset_token_expires DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_librarians_email ON librarians(email);
        CREATE INDEX IF NOT EXISTS idx_librarians_library ON librarians(library_id);
    `);

    // Check if librarians table in SQLite has reset_token columns
    const librarianInfo = sqliteDb.prepare("PRAGMA table_info(librarians)").all();
    const libCols = librarianInfo.map(c => c.name);
    if (!libCols.includes('reset_token_hash')) {
        sqliteDb.exec("ALTER TABLE librarians ADD COLUMN reset_token_hash TEXT DEFAULT NULL;");
    }
    if (!libCols.includes('reset_token_expires')) {
        sqliteDb.exec("ALTER TABLE librarians ADD COLUMN reset_token_expires DATETIME DEFAULT NULL;");
    }

    sqliteDb.exec(`
        CREATE INDEX IF NOT EXISTS idx_librarians_reset_token ON librarians(reset_token_hash);
    `);

    // 2. Books table
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            library_id INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'English',
            isbn TEXT DEFAULT NULL,
            shelf TEXT DEFAULT 'Main Stack A-1',
            publication_year INTEGER DEFAULT 2023,
            cover_image TEXT DEFAULT NULL,
            description TEXT DEFAULT NULL,
            status TEXT CHECK(status IN ('available', 'issued')) NOT NULL DEFAULT 'available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );
    `);

    // Check if books table has library_id, language, cover_image, description columns
    const bookInfo = sqliteDb.prepare("PRAGMA table_info(books)").all();
    const bookColNames = bookInfo.map(col => col.name);
    if (!bookColNames.includes('library_id')) {
        sqliteDb.exec("ALTER TABLE books ADD COLUMN library_id INTEGER NOT NULL DEFAULT 1;");
    }
    if (!bookColNames.includes('language')) {
        sqliteDb.exec("ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'English';");
    }
    if (!bookColNames.includes('cover_image')) {
        sqliteDb.exec("ALTER TABLE books ADD COLUMN cover_image TEXT DEFAULT NULL;");
    }
    if (!bookColNames.includes('description')) {
        sqliteDb.exec("ALTER TABLE books ADD COLUMN description TEXT DEFAULT NULL;");
    }

    // 3. Students table
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            library_id INTEGER NOT NULL DEFAULT 1,
            student_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT DEFAULT NULL,
            department TEXT DEFAULT 'Computer Science',
            phone TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );
    `);

    const studentInfo = sqliteDb.prepare("PRAGMA table_info(students)").all();
    const hasStudentLib = studentInfo.some(col => col.name === 'library_id');
    if (!hasStudentLib) {
        sqliteDb.exec("ALTER TABLE students ADD COLUMN library_id INTEGER NOT NULL DEFAULT 1;");
    }

    // 4. Issues table
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            library_id INTEGER NOT NULL DEFAULT 1,
            book_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT DEFAULT NULL,
            status TEXT CHECK(status IN ('issued', 'returned', 'overdue')) NOT NULL DEFAULT 'issued',
            remarks TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
        );
    `);

    const issueInfo = sqliteDb.prepare("PRAGMA table_info(issues)").all();
    const hasIssueLib = issueInfo.some(col => col.name === 'library_id');
    if (!hasIssueLib) {
        sqliteDb.exec("ALTER TABLE issues ADD COLUMN library_id INTEGER NOT NULL DEFAULT 1;");
    }

    // 5. Bug Tracker Table (TQM Q09)
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS bugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            library_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            module TEXT NOT NULL,
            steps_to_reproduce TEXT DEFAULT NULL,
            expected_result TEXT DEFAULT NULL,
            actual_result TEXT DEFAULT NULL,
            severity TEXT NOT NULL DEFAULT 'Medium',
            status TEXT NOT NULL DEFAULT 'Open',
            reported_by TEXT DEFAULT 'Librarian',
            assigned_to TEXT DEFAULT NULL,
            fix_details TEXT DEFAULT NULL,
            reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_bugs_library ON bugs(library_id);
        CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(library_id, status);
        CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(library_id, severity);
        CREATE INDEX IF NOT EXISTS idx_bugs_module ON bugs(library_id, module);
    `);

    // 6. Test Runs Table (TQM Q09)
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS test_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_tests INTEGER NOT NULL DEFAULT 0,
            passed_tests INTEGER NOT NULL DEFAULT 0,
            failed_tests INTEGER NOT NULL DEFAULT 0,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            summary_json TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_test_runs_date ON test_runs(run_date);
    `);

    // Seed initial sample bugs for Library 1 if empty
    const bugCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM bugs').get();
    if (bugCheck.count === 0) {
        const seedBugs = [
            [1, 'Unchecked duplicate book title on insertion', 'Adding books with the exact same title and author without differentiating edition or ISBN leads to catalog ambiguity.', 'Books', '1. Go to Add Book\n2. Enter identical title and author\n3. Click Save', 'Validation error indicating duplicate catalog record', 'Duplicate book was created', 'Medium', 'Resolved', 'Quality Assurance', 'Dev Team', 'Implemented duplicate book validation in validator.js and server.js with distinct edition support.', '2026-10-18 10:00:00', '2026-10-19 09:30:00'],
            [1, 'Unchecked student ID format in registration', 'Student roll number / ID accepted empty strings or special characters.', 'Students', '1. Go to Students\n2. Add student with empty ID or spaces\n3. Submit', 'Reject with HTTP 400 Bad Request', 'Student was saved with blank or malformed identifier', 'High', 'Resolved', 'QA Lead', 'Dev Team', 'Added strict student_id alphanumeric validation with regex in backend/validator.js.', '2026-10-18 11:30:00', '2026-10-19 10:15:00'],
            [1, 'Circulation transaction rollback safety on double return', 'Attempting to return a book that is already marked as returned could cause unhandled database race.', 'Circulation', '1. Issue a book\n2. Trigger double-click return', 'Second return gracefully rejected with Conflict 409', 'Unhandled query failure before transaction safeguard', 'Critical', 'Resolved', 'Security Team', 'Senior Engineer', 'Added transaction wrapping and status checks with AppError ConflictError.', '2026-10-18 14:00:00', '2026-10-19 11:00:00'],
            [1, 'Log file growth without rotation policy', 'Server error logs could grow unbounded without size limits or rotation.', 'Logging', 'Generate high volume of simulated errors', 'Log file rotates at 5MB limit keeping up to 3 archives', 'Single error.log grew indefinitely', 'Low', 'Resolved', 'DevOps', 'QA Architect', 'Built rotating file stream in backend/logger.js with 5MB cap and 3 rotation backups.', '2026-10-19 08:00:00', '2026-10-19 11:45:00']
        ];
        const insertBug = sqliteDb.prepare(`
            INSERT INTO bugs (library_id, title, description, module, steps_to_reproduce, expected_result, actual_result, severity, status, reported_by, assigned_to, fix_details, reported_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const b of seedBugs) {
            insertBug.run(...b);
        }
    }

    // Seed default library and librarian if not present
    const libCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM libraries').get();
    if (libCheck.count === 0) {
        sqliteDb.prepare("INSERT INTO libraries (id, name) VALUES (1, 'HS Central Library')").run();
        const defaultHash = bcrypt.hashSync('Admin@123', 10);
        sqliteDb.prepare(`
            INSERT INTO librarians (id, library_id, name, email, password_hash, phone, role)
            VALUES (1, 1, 'Head Librarian', 'librarian@hslibrary.edu', ?, '+91 98765 00000', 'admin')
        `).run(defaultHash);
    }

    // Seed initial books, students, and issues if empty
    const bookCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM books').get();
    if (bookCheck.count === 0) {
        console.log('[HS Library DB] Seeding initial books for Library 1 into SQLite...');
        seedInitialDataSQLite();
    }
    // Seed and sync curated collection (idempotent, safe)
    seedCuratedBooksSQLite(1);
}

async function seedInitialDataMySQL() {
    const books = [
        [1, 'Clean Architecture: A Craftsman\'s Guide', 'Robert C. Martin', 'Computer Science', '978-0134494166', 'CS-101', 2017, 'issued'],
        [1, 'Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma, Richard Helm', 'Computer Science', '978-0201633610', 'CS-102', 1994, 'available'],
        [1, 'Introduction to Algorithms (CLRS)', 'Thomas H. Cormen', 'Algorithms', '978-0262033848', 'AL-201', 2009, 'available'],
        [1, 'The Pragmatic Programmer', 'David Thomas, Andrew Hunt', 'Software Engineering', '978-0135957059', 'SE-301', 2019, 'available'],
        [1, 'Artificial Intelligence: A Modern Approach', 'Stuart Russell, Peter Norvig', 'Artificial Intelligence', '978-0136042594', 'AI-401', 2020, 'issued'],
        [1, 'Database System Concepts', 'Abraham Silberschatz', 'Databases', '978-0078022159', 'DB-105', 2019, 'available'],
        [1, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Distributed Systems', '978-1449373320', 'DS-501', 2017, 'available'],
        [1, 'Computer Networking: A Top-Down Approach', 'James F. Kurose, Keith W. Ross', 'Networking', '978-0133594140', 'NET-202', 2021, 'available']
    ];

    for (const b of books) {
        await mysqlPool.query('INSERT INTO books (library_id, title, author, category, isbn, shelf, publication_year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', b);
    }

    const students = [
        [1, 'HS-2024-001', 'Anushka Puri', 'anushka.puri@hslibrary.edu', 'Computer Science', '+91 98765 43210'],
        [1, 'HS-2024-002', 'Rohan Sharma', 'rohan.sharma@hslibrary.edu', 'Information Technology', '+91 98111 22334'],
        [1, 'HS-2024-003', 'Priya Patel', 'priya.patel@hslibrary.edu', 'Data Science', '+91 98222 33445'],
        [1, 'HS-2024-004', 'Aarav Mehta', 'aarav.mehta@hslibrary.edu', 'Artificial Intelligence', '+91 98333 44556'],
        [1, 'HS-2024-005', 'Sneha Iyer', 'sneha.iyer@hslibrary.edu', 'Cybersecurity', '+91 98444 55667']
    ];

    for (const s of students) {
        await mysqlPool.query('INSERT INTO students (library_id, student_id, name, email, department, phone) VALUES (?, ?, ?, ?, ?, ?)', s);
    }

    await mysqlPool.query(`
        INSERT INTO issues (library_id, book_id, student_id, issue_date, due_date, return_date, status, remarks)
        VALUES 
        (1, 1, 1, DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL, 'overdue', 'First renewal requested'),
        (1, 5, 2, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), NULL, 'issued', 'Standard 14-day checkout'),
        (1, 2, 3, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'returned', 'Returned on time in pristine condition'),
        (1, 4, 4, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY), 'returned', 'Completed coursework reading');
    `);
}

function seedInitialDataSQLite() {
    const insertBook = sqliteDb.prepare('INSERT INTO books (library_id, title, author, category, isbn, shelf, publication_year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insertBook.run(1, 'Clean Architecture: A Craftsman\'s Guide', 'Robert C. Martin', 'Computer Science', '978-0134494166', 'CS-101', 2017, 'issued');
    insertBook.run(1, 'Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma, Richard Helm', 'Computer Science', '978-0201633610', 'CS-102', 1994, 'available');
    insertBook.run(1, 'Introduction to Algorithms (CLRS)', 'Thomas H. Cormen', 'Algorithms', '978-0262033848', 'AL-201', 2009, 'available');
    insertBook.run(1, 'The Pragmatic Programmer', 'David Thomas, Andrew Hunt', 'Software Engineering', '978-0135957059', 'SE-301', 2019, 'available');
    insertBook.run(1, 'Artificial Intelligence: A Modern Approach', 'Stuart Russell, Peter Norvig', 'Artificial Intelligence', '978-0136042594', 'AI-401', 2020, 'issued');
    insertBook.run(1, 'Database System Concepts', 'Abraham Silberschatz', 'Databases', '978-0078022159', 'DB-105', 2019, 'available');
    insertBook.run(1, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Distributed Systems', '978-1449373320', 'DS-501', 2017, 'available');
    insertBook.run(1, 'Computer Networking: A Top-Down Approach', 'James F. Kurose, Keith W. Ross', 'Networking', '978-0133594140', 'NET-202', 2021, 'available');

    const insertStudent = sqliteDb.prepare('INSERT INTO students (library_id, student_id, name, email, department, phone) VALUES (?, ?, ?, ?, ?, ?)');
    insertStudent.run(1, 'HS-2024-001', 'Anushka Puri', 'anushka.puri@hslibrary.edu', 'Computer Science', '+91 98765 43210');
    insertStudent.run(1, 'HS-2024-002', 'Rohan Sharma', 'rohan.sharma@hslibrary.edu', 'Information Technology', '+91 98111 22334');
    insertStudent.run(1, 'HS-2024-003', 'Priya Patel', 'priya.patel@hslibrary.edu', 'Data Science', '+91 98222 33445');
    insertStudent.run(1, 'HS-2024-004', 'Aarav Mehta', 'aarav.mehta@hslibrary.edu', 'Artificial Intelligence', '+91 98333 44556');
    insertStudent.run(1, 'HS-2024-005', 'Sneha Iyer', 'sneha.iyer@hslibrary.edu', 'Cybersecurity', '+91 98444 55667');

    const insertIssue = sqliteDb.prepare('INSERT INTO issues (library_id, book_id, student_id, issue_date, due_date, return_date, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    const now = new Date();
    const daysAgo = (d) => {
        const dt = new Date(now.getTime() - d * 86400000);
        return dt.toISOString().split('T')[0];
    };
    const daysFromNow = (d) => {
        const dt = new Date(now.getTime() + d * 86400000);
        return dt.toISOString().split('T')[0];
    };

    insertIssue.run(1, 1, 1, daysAgo(18), daysAgo(4), null, 'overdue', 'First renewal requested');
    insertIssue.run(1, 5, 2, daysAgo(5), daysFromNow(9), null, 'issued', 'Standard 14-day checkout');
    insertIssue.run(1, 2, 3, daysAgo(25), daysAgo(11), daysAgo(12), 'returned', 'Returned on time in pristine condition');
    insertIssue.run(1, 4, 4, daysAgo(30), daysAgo(16), daysAgo(17), 'returned', 'Completed coursework reading');
}

/**
 * Idempotently seed and update curated novels, storybooks, and covers in MySQL
 */
async function seedCuratedBooksMySQL(libraryId = 1) {
    try {
        for (const b of CURATED_BOOKS) {
            const [existing] = await mysqlPool.query(
                'SELECT id FROM books WHERE library_id = ? AND LOWER(title) = LOWER(?)',
                [libraryId, b.title]
            );

            if (existing.length === 0) {
                await mysqlPool.query(`
                    INSERT INTO books 
                    (library_id, title, author, category, language, isbn, shelf, publication_year, cover_image, description, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    libraryId,
                    b.title,
                    b.author,
                    b.category,
                    b.language,
                    b.isbn,
                    b.shelf,
                    b.publication_year,
                    b.cover_image,
                    b.description,
                    b.status
                ]);
            } else {
                await mysqlPool.query(`
                    UPDATE books 
                    SET language = ?, cover_image = ?, description = ?, category = ?, shelf = ?, publication_year = ?, isbn = ?
                    WHERE id = ?
                `, [
                    b.language,
                    b.cover_image,
                    b.description,
                    b.category,
                    b.shelf,
                    b.publication_year,
                    b.isbn,
                    existing[0].id
                ]);
            }
        }

        // Update legacy technical books if their covers or languages are not yet populated
        for (const [title, meta] of Object.entries(TECH_BOOK_COVERS)) {
            await mysqlPool.query(
                'UPDATE books SET language = ?, cover_image = ?, description = ? WHERE library_id = ? AND title = ? AND (cover_image IS NULL OR language IS NULL)',
                [meta.lang, meta.cover, meta.desc, libraryId, title]
            );
        }
    } catch (err) {
        console.error('[HS Library DB] Error during MySQL curated books seeding:', err);
    }
}

/**
 * Idempotently seed and update curated novels, storybooks, and covers in SQLite
 */
function seedCuratedBooksSQLite(libraryId = 1) {
    try {
        const checkStmt = sqliteDb.prepare('SELECT id FROM books WHERE library_id = ? AND LOWER(title) = LOWER(?)');
        const insertStmt = sqliteDb.prepare(`
            INSERT INTO books 
            (library_id, title, author, category, language, isbn, shelf, publication_year, cover_image, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateStmt = sqliteDb.prepare(`
            UPDATE books 
            SET language = ?, cover_image = ?, description = ?, category = ?, shelf = ?, publication_year = ?, isbn = ?
            WHERE id = ?
        `);

        for (const b of CURATED_BOOKS) {
            const existing = checkStmt.get(libraryId, b.title);
            if (!existing) {
                insertStmt.run(
                    libraryId,
                    b.title,
                    b.author,
                    b.category,
                    b.language,
                    b.isbn,
                    b.shelf,
                    b.publication_year,
                    b.cover_image,
                    b.description,
                    b.status
                );
            } else {
                updateStmt.run(
                    b.language,
                    b.cover_image,
                    b.description,
                    b.category,
                    b.shelf,
                    b.publication_year,
                    b.isbn,
                    existing.id
                );
            }
        }

        // Update legacy technical books if their covers or languages are not yet populated
        const updateLegacy = sqliteDb.prepare('UPDATE books SET language = ?, cover_image = ?, description = ? WHERE library_id = ? AND title = ? AND (cover_image IS NULL OR language IS NULL)');
        for (const [title, meta] of Object.entries(TECH_BOOK_COVERS)) {
            updateLegacy.run(meta.lang, meta.cover, meta.desc, libraryId, title);
        }
    } catch (err) {
        console.error('[HS Library DB] Error during SQLite curated books seeding:', err);
    }
}

/**
 * Universal SQL query adapter
 */
async function query(sql, params = []) {
    if (activeDbType === 'mysql') {
        const [rows] = await mysqlPool.query(sql, params);
        if (rows && typeof rows.insertId !== 'undefined') {
            return { insertId: rows.insertId, affectedRows: rows.affectedRows, changedRows: rows.changedRows };
        }
        return rows;
    } else if (activeDbType === 'sqlite') {
        let adaptedSql = sql
            .replace(/CURDATE\(\)/gi, "date('now', 'localtime')")
            .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
            .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, "date($1, '-$2 days')")
            .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, "date($1, '+$2 days')");

        const trimmed = adaptedSql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
            const stmt = sqliteDb.prepare(adaptedSql);
            return stmt.all(...params);
        } else {
            const stmt = sqliteDb.prepare(adaptedSql);
            const info = stmt.run(...params);
            return {
                insertId: Number(info.lastInsertRowid),
                affectedRows: info.changes,
                changedRows: info.changes
            };
        }
    } else {
        throw new Error('Database not initialized');
    }
}

/**
 * Transaction helper for atomic operations
 */
async function transaction(workCallback) {
    if (activeDbType === 'mysql') {
        const connection = await mysqlPool.getConnection();
        await connection.beginTransaction();
        try {
            const txQuery = async (sql, params = []) => {
                const [rows] = await connection.query(sql, params);
                if (rows && typeof rows.insertId !== 'undefined') {
                    return { insertId: rows.insertId, affectedRows: rows.affectedRows };
                }
                return rows;
            };
            const result = await workCallback(txQuery);
            await connection.commit();
            return result;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } else if (activeDbType === 'sqlite') {
        sqliteDb.exec('BEGIN IMMEDIATE;');
        try {
            const txQuery = async (sql, params = []) => {
                let adaptedSql = sql
                    .replace(/CURDATE\(\)/gi, "date('now', 'localtime')")
                    .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
                    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, "date($1, '-$2 days')")
                    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, "date($1, '+$2 days')");

                const trimmed = adaptedSql.trim().toUpperCase();
                if (trimmed.startsWith('SELECT')) {
                    const stmt = sqliteDb.prepare(adaptedSql);
                    return stmt.all(...params);
                } else {
                    const stmt = sqliteDb.prepare(adaptedSql);
                    const info = stmt.run(...params);
                    return {
                        insertId: Number(info.lastInsertRowid),
                        affectedRows: info.changes
                    };
                }
            };
            const result = await workCallback(txQuery);
            sqliteDb.exec('COMMIT;');
            return result;
        } catch (err) {
            try {
                sqliteDb.exec('ROLLBACK;');
            } catch (rollbackErr) {
                // Ignore rollback error if transaction already closed
            }
            throw err;
        }
    }
}

function getDbInfo() {
    return {
        type: activeDbType,
        connected: activeDbType !== null,
        database: DB_NAME,
        host: DB_HOST,
        port: DB_PORT,
        statusMessage: dbStatusMessage,
        isFallback: activeDbType === 'sqlite'
    };
}

module.exports = {
    initDatabase,
    query,
    transaction,
    getDbInfo
};
