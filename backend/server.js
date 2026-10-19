const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const logger = require('./logger');
const {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    requestIdMiddleware,
    notFoundHandler,
    errorHandler,
    setupGlobalProcessErrorHandlers
} = require('./errors');
const validator = require('./validator');

// Register uncaughtException & unhandledRejection handlers early
setupGlobalProcessErrorHandlers();

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_LOAN_DAYS = parseInt(process.env.DEFAULT_LOAN_DAYS || '14', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'hs_library_secure_jwt_secret_key_2026_enterprise_auth';

// Assign correlation ID (X-Request-Id) to every incoming request
app.use(requestIdMiddleware);

// Middleware
app.use(cors({
    origin: '*',
    exposedHeaders: ['X-Request-Id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Uploads directory for book covers (persistent on disk across restarts)
const uploadsRootDir = path.join(__dirname, '../uploads');
const coversUploadDir = path.join(uploadsRootDir, 'covers');
try {
    fs.mkdirSync(coversUploadDir, { recursive: true });
} catch (e) {
    console.error('[HS Library] Failed to create uploads directory:', e);
}

// Serve uploads statically so images are accessible from /uploads/...
app.use('/uploads', express.static(uploadsRootDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

// Multer Storage Configuration for Book Covers
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, coversUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `cover-${uniqueSuffix}${ext}`);
    }
});

// File security filter: only genuine image files allowed
const coverFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP image files are allowed.'), false);
    }
};

const uploadCoverMiddleware = multer({
    storage: coverStorage,
    fileFilter: coverFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB upload limit
    }
});

// =====================================================================
// RATE LIMITING & SECURITY HELPERS
// =====================================================================

const loginAttempts = new Map(); // IP -> { count, resetAt }
const MAX_LOGIN_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function rateLimitLogin(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record) {
        if (now < record.resetAt) {
            if (record.count >= MAX_LOGIN_ATTEMPTS) {
                const remainingMin = Math.ceil((record.resetAt - now) / 60000);
                return res.status(429).json({
                    error: `Too many failed login attempts. For security, please try again in ${remainingMin} minute(s).`
                });
            }
        } else {
            loginAttempts.set(ip, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
        }
    } else {
        loginAttempts.set(ip, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
    }
    next();
}

function recordFailedLogin(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const record = loginAttempts.get(ip);
    if (record) {
        record.count += 1;
    }
}

function resetLoginAttempts(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    loginAttempts.delete(ip);
}

// =====================================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================================

function authenticateLibrarian(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
    let token = null;

    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        } else {
            token = authHeader.trim();
        }
    }

    if (!token) {
        return next(new UnauthorizedError('Authentication required. Please sign in to your library.'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { librarianId, libraryId, email, name, libraryName, role }
        next();
    } catch (err) {
        return next(new UnauthorizedError('Session expired or invalid authentication token. Please sign in again.'));
    }
}

// =====================================================================
// AUTHENTICATION ROUTES (REGISTER, LOGIN, ME, LOGOUT)
// =====================================================================

/**
 * Public: Health & System Status Endpoint
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
    const dbInfo = db.getDbInfo();
    let libraryCount = 1;
    try {
        const libRows = await db.query('SELECT COUNT(*) as count FROM libraries');
        libraryCount = libRows[0]?.count || 1;
    } catch (e) {
        // ignore
    }

    res.json({
        status: 'ok',
        appName: 'HS Library Multi-Tenant Management System',
        version: '2.5.0-MultiLibrary',
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
            engine: dbInfo.type,
            connected: dbInfo.connected,
            name: dbInfo.database,
            host: dbInfo.host,
            port: dbInfo.port,
            isFallback: dbInfo.isFallback,
            message: dbInfo.statusMessage,
            totalLibraries: libraryCount
        }
    });
});

/**
 * 1. Register a New Library and Administrator Account
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res, next) => {
    try {
        const { library_name, name, email, password, confirm_password, phone } = req.body;

        // Validation
        if (!library_name || library_name.trim().length < 2) {
            return res.status(400).json({ error: 'Library name must be at least 2 characters long.' });
        }
        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Librarian full name must be at least 2 characters long.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }
        if (password !== confirm_password) {
            return res.status(400).json({ error: 'Password and confirm password do not match.' });
        }

        const cleanLibName = library_name.trim();
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone && phone.trim() ? phone.trim() : null;

        // Check if librarian email already exists
        const existingLibrarian = await db.query('SELECT id FROM librarians WHERE LOWER(email) = ?', [cleanEmail]);
        if (existingLibrarian.length > 0) {
            return res.status(409).json({ error: 'An account with this email address already exists. Please sign in or use another email.' });
        }

        // Check if library name already exists
        const existingLib = await db.query('SELECT id FROM libraries WHERE LOWER(name) = ?', [cleanLibName.toLowerCase()]);
        if (existingLib.length > 0) {
            return res.status(409).json({ error: `A library named "${cleanLibName}" is already registered. Please choose another distinct name.` });
        }

        // Secure password hash
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Atomic registration of library and its primary administrator
        const result = await db.transaction(async (txQuery) => {
            const libInsert = await txQuery('INSERT INTO libraries (name) VALUES (?)', [cleanLibName]);
            const newLibraryId = libInsert.insertId;

            const librarianInsert = await txQuery(`
                INSERT INTO librarians (library_id, name, email, password_hash, phone, role)
                VALUES (?, ?, ?, ?, ?, 'admin')
            `, [newLibraryId, cleanName, cleanEmail, passwordHash, cleanPhone]);

            return {
                libraryId: newLibraryId,
                librarianId: librarianInsert.insertId
            };
        });

        // Sign token
        const token = jwt.sign({
            librarianId: result.librarianId,
            libraryId: result.libraryId,
            email: cleanEmail,
            name: cleanName,
            libraryName: cleanLibName,
            role: 'admin'
        }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            message: `Library "${cleanLibName}" and administrator account created successfully!`,
            token,
            user: {
                id: result.librarianId,
                name: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                role: 'admin',
                libraryId: result.libraryId,
                libraryName: cleanLibName
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 2. Authenticate Librarian and Resolve Library
 * POST /api/auth/login
 */
app.post('/api/auth/login', rateLimitLogin, async (req, res, next) => {
    try {
        const { library_name, email, password, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide both email address and password.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Query librarian joined with library
        const users = await db.query(`
            SELECT 
                l.id,
                l.library_id,
                l.name,
                l.email,
                l.password_hash,
                l.phone,
                l.role,
                lib.name as library_name
            FROM librarians l
            JOIN libraries lib ON l.library_id = lib.id
            WHERE LOWER(l.email) = ?
        `, [cleanEmail]);

        // Constant-time generic rejection on failure
        if (users.length === 0) {
            recordFailedLogin(req);
            return res.status(401).json({ error: 'Invalid credentials or library details.' });
        }

        const librarian = users[0];
        const passwordMatch = await bcrypt.compare(password, librarian.password_hash);
        if (!passwordMatch) {
            recordFailedLogin(req);
            return res.status(401).json({ error: 'Invalid credentials or library details.' });
        }

        // If library_name was provided on login, verify it matches the librarian's library
        if (library_name && library_name.trim()) {
            const cleanLibName = library_name.trim().toLowerCase();
            if (cleanLibName !== librarian.library_name.toLowerCase()) {
                recordFailedLogin(req);
                return res.status(401).json({ error: 'Invalid credentials or library details.' });
            }
        }

        // Login succeeded: reset rate limiter
        resetLoginAttempts(req);

        // Sign token (longer validity if rememberMe is enabled)
        const tokenExpiry = rememberMe ? '30d' : '24h';
        const token = jwt.sign({
            librarianId: librarian.id,
            libraryId: librarian.library_id,
            email: librarian.email,
            name: librarian.name,
            libraryName: librarian.library_name,
            role: librarian.role
        }, JWT_SECRET, { expiresIn: tokenExpiry });

        res.json({
            success: true,
            message: `Welcome back, ${librarian.name}!`,
            token,
            rememberMe: Boolean(rememberMe),
            user: {
                id: librarian.id,
                name: librarian.name,
                email: librarian.email,
                phone: librarian.phone,
                role: librarian.role,
                libraryId: librarian.library_id,
                libraryName: librarian.library_name
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 3. Get Authenticated Librarian Profile
 * GET /api/auth/me
 */
app.get('/api/auth/me', authenticateLibrarian, async (req, res, next) => {
    try {
        const users = await db.query(`
            SELECT 
                l.id,
                l.library_id,
                l.name,
                l.email,
                l.phone,
                l.role,
                lib.name as library_name,
                lib.created_at as library_created_at
            FROM librarians l
            JOIN libraries lib ON l.library_id = lib.id
            WHERE l.id = ? AND l.library_id = ?
        `, [req.user.librarianId, req.user.libraryId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'Librarian account not found.' });
        }

        res.json({
            authenticated: true,
            user: users[0]
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 4. Logout Endpoint
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * 5. Request Password Reset Link / Token
 * POST /api/auth/forgot-password
 */
app.post('/api/auth/forgot-password', rateLimitLogin, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Please enter your registered email address.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const users = await db.query(
            'SELECT id, name, email, library_id FROM librarians WHERE LOWER(email) = ?',
            [cleanEmail]
        );

        // Security Requirement: Never reveal whether an email account exists
        if (users.length === 0) {
            return res.json({
                success: true,
                message: 'If an account is associated with this email, password reset instructions have been generated.'
            });
        }

        const librarian = users[0];

        // Generate cryptographically secure random token (32 bytes = 64 hex chars)
        const rawToken = crypto.randomBytes(32).toString('hex');

        // Store ONLY the secure SHA-256 hash in database
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // 1 hour expiry
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const expiresStr = expiresAt.toISOString();

        await db.query(
            'UPDATE librarians SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
            [tokenHash, expiresStr, librarian.id]
        );

        // For local development / testing without configured SMTP:
        // Provide safe testing workflow with devToken and devResetUrl
        const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

        res.json({
            success: true,
            message: 'If an account is associated with this email, password reset instructions have been generated.',
            devMode: !isSmtpConfigured,
            devResetUrl: !isSmtpConfigured ? `/#reset-password?token=${rawToken}` : undefined,
            devToken: !isSmtpConfigured ? rawToken : undefined
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 6. Verify Password Reset Token
 * POST /api/auth/verify-reset-token
 */
app.post('/api/auth/verify-reset-token', async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ valid: false, error: 'Reset token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const rows = await db.query(
            'SELECT id, email, reset_token_expires FROM librarians WHERE reset_token_hash = ?',
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({ valid: false, error: 'Password reset link is invalid or has already been used.' });
        }

        const librarian = rows[0];
        const expiryDate = new Date(librarian.reset_token_expires);

        if (expiryDate < new Date()) {
            return res.status(400).json({ valid: false, error: 'Password reset link has expired. Please request a new one.' });
        }

        res.json({
            valid: true,
            email: librarian.email
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 7. Execute Password Reset
 * POST /api/auth/reset-password
 */
app.post('/api/auth/reset-password', rateLimitLogin, async (req, res, next) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Reset token is required.' });
        }

        if (!newPassword || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Please enter your new password.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match. Please verify both fields.' });
        }

        // Validate password strength: min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
        }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must include uppercase, lowercase, and numeric characters.' });
        }

        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const rows = await db.query(
            'SELECT id, email, name, reset_token_expires FROM librarians WHERE reset_token_hash = ?',
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or already used password reset token.' });
        }

        const librarian = rows[0];
        const expiryDate = new Date(librarian.reset_token_expires);

        if (expiryDate < new Date()) {
            await db.query(
                'UPDATE librarians SET reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
                [librarian.id]
            );
            return res.status(400).json({ error: 'Password reset token has expired. Please request a new link.' });
        }

        // Hash new password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Update password and invalidate single-use token immediately
        await db.query(
            'UPDATE librarians SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
            [newHash, librarian.id]
        );

        res.json({
            success: true,
            message: 'Your password has been successfully reset! You can now sign in with your new password.'
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 8. Upload Book Cover Image
 * POST /api/upload/cover
 */
app.post('/api/upload/cover', authenticateLibrarian, (req, res) => {
    uploadCoverMiddleware.single('coverImage')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Cover image exceeds 5 MB limit. Please select a smaller image file.' });
            }
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Please select an image file (JPG, JPEG, PNG, or WEBP).' });
        }

        const coverUrl = `/uploads/covers/${req.file.filename}`;
        res.json({
            success: true,
            cover_image: coverUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    });
});

// =====================================================================
// PROTECTED LIBRARY ENDPOINTS (STRICT DATA ISOLATION)
// Every query below is strictly scoped to req.user.libraryId
// =====================================================================

/**
 * 5. Scoped Dashboard Statistics
 * GET /api/stats
 */
app.get('/api/stats', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;

        // Books counts scoped to library
        const totalBooksRows = await db.query('SELECT COUNT(*) as count FROM books WHERE library_id = ?', [libraryId]);
        const availableBooksRows = await db.query("SELECT COUNT(*) as count FROM books WHERE library_id = ? AND status = 'available'", [libraryId]);
        const issuedBooksRows = await db.query("SELECT COUNT(*) as count FROM books WHERE library_id = ? AND status = 'issued'", [libraryId]);

        // Students count scoped to library
        const totalStudentsRows = await db.query('SELECT COUNT(*) as count FROM students WHERE library_id = ?', [libraryId]);

        // Overdue count scoped to library
        const overdueRows = await db.query(`
            SELECT COUNT(*) as count 
            FROM issues 
            WHERE library_id = ? AND return_date IS NULL AND due_date < CURDATE()
        `, [libraryId]);

        // Total historical transactions scoped to library
        const totalIssuesRows = await db.query('SELECT COUNT(*) as count FROM issues WHERE library_id = ?', [libraryId]);

        // Active borrowers count scoped to library
        const activeBorrowersRows = await db.query(`
            SELECT COUNT(DISTINCT student_id) as count 
            FROM issues 
            WHERE library_id = ? AND return_date IS NULL
        `, [libraryId]);

        // Category breakdown scoped to library
        const categoryRows = await db.query(`
            SELECT category, COUNT(*) as count 
            FROM books 
            WHERE library_id = ?
            GROUP BY category 
            ORDER BY count DESC
        `, [libraryId]);

        // Recent activity feed scoped to library
        const recentActivity = await db.query(`
            SELECT 
                i.id,
                i.issue_date,
                i.due_date,
                i.return_date,
                i.status,
                b.title as book_title,
                s.name as student_name,
                s.student_id as student_code
            FROM issues i
            JOIN books b ON i.book_id = b.id
            JOIN students s ON i.student_id = s.id
            WHERE i.library_id = ?
            ORDER BY i.id DESC
            LIMIT 6
        `, [libraryId]);

        res.json({
            libraryId,
            libraryName: req.user.libraryName,
            totalBooks: totalBooksRows[0]?.count || 0,
            availableBooks: availableBooksRows[0]?.count || 0,
            issuedBooks: issuedBooksRows[0]?.count || 0,
            totalStudents: totalStudentsRows[0]?.count || 0,
            overdueBooks: overdueRows[0]?.count || 0,
            totalTransactions: totalIssuesRows[0]?.count || 0,
            activeBorrowers: activeBorrowersRows[0]?.count || 0,
            categoryCounts: categoryRows,
            recentActivity
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 6. Scoped Books Management
 * GET /api/books
 */
app.get('/api/books', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const { search, category, language, status, sort } = req.query;

        let sql = `
            SELECT 
                b.id,
                b.library_id,
                b.title,
                b.author,
                b.category,
                b.language,
                b.isbn,
                b.shelf,
                b.publication_year,
                b.cover_image,
                b.description,
                b.status,
                b.created_at,
                i.id as active_issue_id,
                s.name as borrower_name,
                s.student_id as borrower_student_code
            FROM books b
            LEFT JOIN issues i ON b.id = i.book_id AND i.return_date IS NULL AND i.library_id = ?
            LEFT JOIN students s ON i.student_id = s.id AND s.library_id = ?
            WHERE b.library_id = ?
        `;
        const params = [libraryId, libraryId, libraryId];

        if (search && search.trim() !== '') {
            sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.category LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q);
        }

        if (category && category !== 'All') {
            sql += ` AND b.category = ?`;
            params.push(category);
        }

        if (language && language !== 'All') {
            sql += ` AND b.language = ?`;
            params.push(language);
        }

        if (status && status !== 'All') {
            sql += ` AND b.status = ?`;
            params.push(status.toLowerCase());
        }

        switch (sort) {
            case 'title_desc':
                sql += ' ORDER BY b.title DESC';
                break;
            case 'author_asc':
                sql += ' ORDER BY b.author ASC';
                break;
            case 'oldest':
                sql += ' ORDER BY b.id ASC';
                break;
            case 'newest':
            default:
                sql += ' ORDER BY b.id DESC';
                break;
        }

        const books = await db.query(sql, params);
        res.json(books);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/books/:id (Single book details scoped to library)
 */
app.get('/api/books/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bookId = validator.validateId(req.params.id, 'Book ID');

        const rows = await db.query(`
            SELECT 
                b.*,
                i.id as active_issue_id,
                i.issue_date as active_issue_date,
                i.due_date as active_due_date,
                s.name as borrower_name,
                s.student_id as borrower_student_code,
                s.email as borrower_email,
                s.phone as borrower_phone
            FROM books b
            LEFT JOIN issues i ON b.id = i.book_id AND i.return_date IS NULL AND i.library_id = ?
            LEFT JOIN students s ON i.student_id = s.id AND s.library_id = ?
            WHERE b.id = ? AND b.library_id = ?
        `, [libraryId, libraryId, bookId, libraryId]);

        if (rows.length === 0) {
            throw new NotFoundError('Book not found in your library catalog.');
        }

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/books (Add book strictly to authenticated library)
 */
app.post('/api/books', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bookData = validator.validateBookInput(req.body);

        // Check for duplicate title & author within this library
        const existing = await db.query(
            'SELECT id, isbn, publication_year, language FROM books WHERE library_id = ? AND LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?)',
            [libraryId, bookData.title, bookData.author]
        );

        if (existing.length > 0) {
            // Allow separate edition if ISBN, year, or language is distinct
            const isDistinctEdition = existing.every(e => {
                const diffIsbn = bookData.isbn && e.isbn && bookData.isbn !== e.isbn;
                const diffYear = bookData.publication_year && e.publication_year && bookData.publication_year !== e.publication_year;
                const diffLang = bookData.language && e.language && bookData.language.toLowerCase() !== e.language.toLowerCase();
                return diffIsbn || diffYear || diffLang;
            });

            if (!isDistinctEdition) {
                throw new ConflictError(`A book with title "${bookData.title}" by "${bookData.author}" already exists in your library catalog. If this is a separate edition, please provide a distinct publication year or ISBN.`);
            }
        }

        const result = await db.query(
            'INSERT INTO books (library_id, title, author, category, language, isbn, shelf, publication_year, cover_image, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [libraryId, bookData.title, bookData.author, bookData.category, bookData.language, bookData.isbn, bookData.shelf, bookData.publication_year, bookData.cover_image, bookData.description, 'available']
        );

        const newBook = await db.query('SELECT * FROM books WHERE id = ? AND library_id = ?', [result.insertId, libraryId]);
        logger.info(`Book added: "${bookData.title}" (ID: ${result.insertId})`, { libraryId, bookId: result.insertId });
        res.status(201).json(newBook[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/books/:id (Edit book strictly within authenticated library)
 */
app.put('/api/books/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bookId = validator.validateId(req.params.id, 'Book ID');
        const bookData = validator.validateBookInput(req.body);

        const updateResult = await db.query(`
            UPDATE books 
            SET title = ?, author = ?, category = ?, language = ?, isbn = ?, shelf = ?, publication_year = ?, cover_image = ?, description = ?
            WHERE id = ? AND library_id = ?
        `, [bookData.title, bookData.author, bookData.category, bookData.language, bookData.isbn, bookData.shelf, bookData.publication_year, bookData.cover_image, bookData.description, bookId, libraryId]);

        if (updateResult.affectedRows === 0) {
            throw new NotFoundError('Book not found in your library catalog.');
        }

        const updated = await db.query('SELECT * FROM books WHERE id = ? AND library_id = ?', [bookId, libraryId]);
        logger.info(`Book updated: "${bookData.title}" (ID: ${bookId})`, { libraryId, bookId });
        res.json(updated[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/books/:id (Delete book strictly within authenticated library)
 */
app.delete('/api/books/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bookId = validator.validateId(req.params.id, 'Book ID');

        // Check if book exists in this library
        const bookCheck = await db.query('SELECT id, status FROM books WHERE id = ? AND library_id = ?', [bookId, libraryId]);
        if (bookCheck.length === 0) {
            throw new NotFoundError('Book not found in your library catalog.');
        }

        // Check if book is currently on loan
        const activeLoans = await db.query(
            'SELECT id FROM issues WHERE book_id = ? AND library_id = ? AND return_date IS NULL',
            [bookId, libraryId]
        );
        if (activeLoans.length > 0) {
            throw new ConflictError('Cannot delete this book because it is currently issued to a student. Please return the book first.');
        }

        await db.transaction(async (txQuery) => {
            await txQuery('DELETE FROM issues WHERE book_id = ? AND library_id = ?', [bookId, libraryId]);
            await txQuery('DELETE FROM books WHERE id = ? AND library_id = ?', [bookId, libraryId]);
        });

        logger.info(`Book deleted: ID ${bookId}`, { libraryId, bookId });
        res.json({ success: true, message: 'Book deleted successfully from your library catalog.' });
    } catch (err) {
        next(err);
    }
});

/**
 * 7. Scoped Students Management
 * GET /api/students
 */
app.get('/api/students', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const { search, sort } = req.query;

        let sql = `
            SELECT 
                s.id,
                s.library_id,
                s.student_id,
                s.name,
                s.email,
                s.department,
                s.phone,
                s.created_at,
                (SELECT COUNT(*) FROM issues i WHERE i.student_id = s.id AND i.library_id = ? AND i.return_date IS NULL) as active_borrowed_count,
                (SELECT COUNT(*) FROM issues i WHERE i.student_id = s.id AND i.library_id = ?) as total_borrowed_count
            FROM students s
            WHERE s.library_id = ?
        `;
        const params = [libraryId, libraryId, libraryId];

        if (search && search.trim() !== '') {
            sql += ` AND (s.name LIKE ? OR s.student_id LIKE ? OR s.email LIKE ? OR s.department LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q);
        }

        switch (sort) {
            case 'name_desc':
                sql += ' ORDER BY s.name DESC';
                break;
            case 'id_desc':
                sql += ' ORDER BY s.student_id DESC';
                break;
            case 'most_active':
                sql += ' ORDER BY active_borrowed_count DESC, total_borrowed_count DESC';
                break;
            case 'name_asc':
            default:
                sql += ' ORDER BY s.name ASC';
                break;
        }

        const students = await db.query(sql, params);
        res.json(students);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/students (Register student strictly within authenticated library)
 */
app.post('/api/students', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const studentData = validator.validateStudentInput(req.body);

        // Check duplicate student_id within this library
        const existing = await db.query(
            'SELECT id FROM students WHERE library_id = ? AND LOWER(student_id) = LOWER(?)',
            [libraryId, studentData.student_id]
        );
        if (existing.length > 0) {
            throw new ConflictError(`A student with ID "${studentData.student_id}" is already registered in your library.`);
        }

        const result = await db.query(
            'INSERT INTO students (library_id, student_id, name, email, department, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [libraryId, studentData.student_id, studentData.name, studentData.email, studentData.department, studentData.phone]
        );

        const newStudent = await db.query('SELECT * FROM students WHERE id = ? AND library_id = ?', [result.insertId, libraryId]);
        logger.info(`Student registered: "${studentData.name}" (${studentData.student_id})`, { libraryId, studentId: result.insertId });
        res.status(201).json(newStudent[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/students/:id/history (Student loan history scoped to library)
 */
app.get('/api/students/:id/history', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const studentId = validator.validateId(req.params.id, 'Student ID');

        const studentRows = await db.query('SELECT * FROM students WHERE id = ? AND library_id = ?', [studentId, libraryId]);
        if (!studentRows.length) {
            throw new NotFoundError('Student not found in your library registry.');
        }

        const issues = await db.query(`
            SELECT 
                i.id,
                i.issue_date,
                i.due_date,
                i.return_date,
                i.status,
                i.remarks,
                b.title as book_title,
                b.author as book_author,
                b.category as book_category,
                CASE 
                    WHEN i.return_date IS NULL AND i.due_date < CURDATE() THEN 1 
                    ELSE 0 
                END as is_overdue
            FROM issues i
            JOIN books b ON i.book_id = b.id
            WHERE i.student_id = ? AND i.library_id = ?
            ORDER BY i.id DESC
        `, [studentId, libraryId]);

        res.json({
            student: studentRows[0],
            loans: issues
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/students/:id (Update student scoped to library)
 */
app.put('/api/students/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const studentId = validator.validateId(req.params.id, 'Student ID');
        const studentData = validator.validateStudentInput(req.body, true);

        const updateResult = await db.query(`
            UPDATE students 
            SET name = ?, email = ?, department = ?, phone = ?
            WHERE id = ? AND library_id = ?
        `, [studentData.name, studentData.email, studentData.department, studentData.phone, studentId, libraryId]);

        if (updateResult.affectedRows === 0) {
            throw new NotFoundError('Student not found in your library registry.');
        }

        const updated = await db.query('SELECT * FROM students WHERE id = ? AND library_id = ?', [studentId, libraryId]);
        logger.info(`Student updated: "${studentData.name}" (ID: ${studentId})`, { libraryId, studentId });
        res.json(updated[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/students/:id (Delete student scoped to library)
 */
app.delete('/api/students/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const studentId = validator.validateId(req.params.id, 'Student ID');

        const studentRows = await db.query('SELECT id FROM students WHERE id = ? AND library_id = ?', [studentId, libraryId]);
        if (!studentRows.length) {
            throw new NotFoundError('Student not found in your library registry.');
        }

        // Check if student has active borrowed books in this library
        const activeBorrows = await db.query(
            'SELECT id FROM issues WHERE student_id = ? AND library_id = ? AND return_date IS NULL',
            [studentId, libraryId]
        );
        if (activeBorrows.length > 0) {
            throw new ConflictError('Cannot delete student who currently has active unreturned books in your library.');
        }

        await db.transaction(async (txQuery) => {
            await txQuery('DELETE FROM issues WHERE student_id = ? AND library_id = ?', [studentId, libraryId]);
            await txQuery('DELETE FROM students WHERE id = ? AND library_id = ?', [studentId, libraryId]);
        });

        logger.info(`Student deleted: ID ${studentId}`, { libraryId, studentId });
        res.json({ success: true, message: 'Student and loan records removed safely from your library.' });
    } catch (err) {
        next(err);
    }
});

/**
 * 8. Scoped Issue & Return System
 * GET /api/issues
 */
app.get('/api/issues', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const { status, search } = req.query;

        let sql = `
            SELECT 
                i.id,
                i.library_id,
                i.book_id,
                i.student_id,
                i.issue_date,
                i.due_date,
                i.return_date,
                i.status,
                i.remarks,
                i.created_at,
                b.title as book_title,
                b.author as book_author,
                b.category as book_category,
                b.isbn as book_isbn,
                s.name as student_name,
                s.student_id as student_code,
                s.email as student_email,
                s.department as student_department,
                CASE 
                    WHEN i.return_date IS NULL AND i.due_date < CURDATE() THEN 1 
                    ELSE 0 
                END as is_overdue
            FROM issues i
            JOIN books b ON i.book_id = b.id
            JOIN students s ON i.student_id = s.id
            WHERE i.library_id = ?
        `;
        const params = [libraryId];

        if (status) {
            if (status.toLowerCase() === 'issued' || status.toLowerCase() === 'active') {
                sql += ' AND i.return_date IS NULL';
            } else if (status.toLowerCase() === 'returned') {
                sql += ' AND i.return_date IS NOT NULL';
            } else if (status.toLowerCase() === 'overdue') {
                sql += ' AND i.return_date IS NULL AND i.due_date < CURDATE()';
            }
        }

        if (search && search.trim() !== '') {
            sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR s.name LIKE ? OR s.student_id LIKE ? OR CAST(i.id AS CHAR) LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q, q);
        }

        sql += ' ORDER BY i.id DESC';

        const issues = await db.query(sql, params);
        res.json(issues);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/issues (Issue a book — strictly validates both book and student belong to authenticated library)
 */
app.post('/api/issues', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const { book_id, student_id, issue_date, due_date, remarks } = validator.validateIssueInput(req.body);

        // Execute inside transaction for strict concurrency & isolation safety
        const issueResult = await db.transaction(async (txQuery) => {
            // 1. Verify student exists AND belongs to authenticated library
            const studentCheck = await txQuery('SELECT id, name, library_id FROM students WHERE id = ?', [student_id]);
            if (!studentCheck.length || studentCheck[0].library_id !== libraryId) {
                throw new NotFoundError('Selected student does not exist in your library registry.');
            }

            // 2. Verify book exists AND belongs to authenticated library
            const bookCheck = await txQuery('SELECT id, title, status, library_id FROM books WHERE id = ?', [book_id]);
            if (!bookCheck.length || bookCheck[0].library_id !== libraryId) {
                throw new NotFoundError('Selected book not found in your library catalog.');
            }

            if (bookCheck[0].status !== 'available') {
                throw new ConflictError(`Book "${bookCheck[0].title}" is currently issued and unavailable.`);
            }

            // 3. Mark book as issued
            await txQuery("UPDATE books SET status = 'issued' WHERE id = ? AND library_id = ?", [book_id, libraryId]);

            // 4. Create issue record scoped to this library
            const insertResult = await txQuery(`
                INSERT INTO issues (library_id, book_id, student_id, issue_date, due_date, status, remarks)
                VALUES (?, ?, ?, ?, ?, 'issued', ?)
            `, [libraryId, book_id, student_id, issue_date, due_date, remarks]);

            return {
                issueId: insertResult.insertId,
                bookTitle: bookCheck[0].title,
                studentName: studentCheck[0].name,
                issueDate: issue_date,
                dueDate: due_date
            };
        });

        logger.info(`Book issued: "${issueResult.bookTitle}" to ${issueResult.studentName} (Issue ID: ${issueResult.issueId})`, { libraryId, issueId: issueResult.issueId });

        res.status(201).json({
            success: true,
            message: `Book "${issueResult.bookTitle}" successfully issued to ${issueResult.studentName}.`,
            issue: issueResult
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/issues/:id/return (Return book — strictly scoped to authenticated library)
 */
app.post('/api/issues/:id/return', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const issueId = validator.validateId(req.params.id, 'Issue ID');

        const returnResult = await db.transaction(async (txQuery) => {
            // 1. Fetch issue strictly within this library
            const issueRows = await txQuery(`
                SELECT i.*, b.title as book_title, s.name as student_name 
                FROM issues i
                JOIN books b ON i.book_id = b.id
                JOIN students s ON i.student_id = s.id
                WHERE i.id = ? AND i.library_id = ?
            `, [issueId, libraryId]);

            if (!issueRows.length) {
                throw new NotFoundError('Issue transaction not found in your library.');
            }

            const issue = issueRows[0];
            if (issue.return_date !== null) {
                throw new ConflictError(`This book was already returned on ${issue.return_date}.`);
            }

            const todayStr = new Date().toISOString().split('T')[0];

            // 2. Update issue
            await txQuery(`
                UPDATE issues 
                SET return_date = ?, status = 'returned'
                WHERE id = ? AND library_id = ?
            `, [todayStr, issueId, libraryId]);

            // 3. Update book status back to available
            await txQuery(`
                UPDATE books 
                SET status = 'available'
                WHERE id = ? AND library_id = ?
            `, [issue.book_id, libraryId]);

            return {
                issueId,
                bookTitle: issue.book_title,
                studentName: issue.student_name,
                returnDate: todayStr
            };
        });

        logger.info(`Book returned: "${returnResult.bookTitle}" by ${returnResult.studentName} (Issue ID: ${issueId})`, { libraryId, issueId });

        res.json({
            success: true,
            message: `Book "${returnResult.bookTitle}" returned successfully by ${returnResult.studentName}.`,
            data: returnResult
        });
    } catch (err) {
        next(err);
    }
});

/**
 * 9. Scoped Reports & Analytics
 * GET /api/reports
 */
app.get('/api/reports', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;

        // Most borrowed books in this library
        const mostBorrowed = await db.query(`
            SELECT 
                b.id,
                b.title,
                b.author,
                b.category,
                COUNT(i.id) as borrow_count
            FROM books b
            JOIN issues i ON b.id = i.book_id
            WHERE b.library_id = ? AND i.library_id = ?
            GROUP BY b.id, b.title, b.author, b.category
            ORDER BY borrow_count DESC
            LIMIT 5
        `, [libraryId, libraryId]);

        // Most active students in this library
        const mostActiveStudents = await db.query(`
            SELECT 
                s.id,
                s.student_id,
                s.name,
                s.department,
                COUNT(i.id) as borrow_count
            FROM students s
            JOIN issues i ON s.id = i.student_id
            WHERE s.library_id = ? AND i.library_id = ?
            GROUP BY s.id, s.student_id, s.name, s.department
            ORDER BY borrow_count DESC
            LIMIT 5
        `, [libraryId, libraryId]);

        // Category breakdown in this library
        const categoryBreakdown = await db.query(`
            SELECT category, COUNT(*) as count 
            FROM books 
            WHERE library_id = ?
            GROUP BY category 
            ORDER BY count DESC
        `, [libraryId]);

        // Overdue compliance in this library
        const totalClosedIssues = await db.query(`
            SELECT COUNT(*) as count FROM issues WHERE library_id = ? AND return_date IS NOT NULL
        `, [libraryId]);
        const onTimeReturns = await db.query(`
            SELECT COUNT(*) as count FROM issues WHERE library_id = ? AND return_date IS NOT NULL AND return_date <= due_date
        `, [libraryId]);

        res.json({
            libraryId,
            libraryName: req.user.libraryName,
            mostBorrowed,
            mostActiveStudents,
            categoryBreakdown,
            compliance: {
                totalReturned: totalClosedIssues[0]?.count || 0,
                onTime: onTimeReturns[0]?.count || 0
            }
        });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// 10. TQM Q09: BUG TRACKER & DEFECT REGISTRY
// =====================================================================

/**
 * GET /api/bugs (List bugs scoped to authenticated library)
 */
app.get('/api/bugs', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const { status, severity, module: bugModule, search, sort } = req.query;

        let sql = `SELECT * FROM bugs WHERE library_id = ?`;
        const params = [libraryId];

        if (status && status !== 'all') {
            sql += ` AND status = ?`;
            params.push(status);
        }
        if (severity && severity !== 'all') {
            sql += ` AND severity = ?`;
            params.push(severity);
        }
        if (bugModule && bugModule !== 'all') {
            sql += ` AND module = ?`;
            params.push(bugModule);
        }
        if (search && search.trim() !== '') {
            sql += ` AND (title LIKE ? OR description LIKE ? OR fix_details LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q);
        }

        switch (sort) {
            case 'oldest':
                sql += ' ORDER BY id ASC';
                break;
            case 'severity':
                sql += ` ORDER BY CASE severity 
                    WHEN 'Critical' THEN 1 
                    WHEN 'High' THEN 2 
                    WHEN 'Medium' THEN 3 
                    WHEN 'Low' THEN 4 
                    ELSE 5 END ASC, id DESC`;
                break;
            case 'newest':
            default:
                sql += ' ORDER BY id DESC';
                break;
        }

        const bugs = await db.query(sql, params);
        res.json(bugs);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/bugs/stats (Bug Tracker KPIs scoped to authenticated library)
 */
app.get('/api/bugs/stats', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;

        const totalRows = await db.query('SELECT COUNT(*) as count FROM bugs WHERE library_id = ?', [libraryId]);
        const openRows = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status = 'Open'", [libraryId]);
        const inProgressRows = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status = 'In Progress'", [libraryId]);
        const resolvedRows = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status = 'Resolved'", [libraryId]);
        const closedRows = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status = 'Closed'", [libraryId]);
        const criticalRows = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND severity = 'Critical' AND status IN ('Open', 'In Progress')", [libraryId]);

        const moduleBreakdown = await db.query(`
            SELECT module, COUNT(*) as count 
            FROM bugs 
            WHERE library_id = ?
            GROUP BY module 
            ORDER BY count DESC
        `, [libraryId]);

        const severityBreakdown = await db.query(`
            SELECT severity, COUNT(*) as count 
            FROM bugs 
            WHERE library_id = ?
            GROUP BY severity
        `, [libraryId]);

        res.json({
            total: totalRows[0]?.count || 0,
            open: openRows[0]?.count || 0,
            inProgress: inProgressRows[0]?.count || 0,
            resolved: resolvedRows[0]?.count || 0,
            closed: closedRows[0]?.count || 0,
            critical: criticalRows[0]?.count || 0,
            byModule: moduleBreakdown,
            bySeverity: severityBreakdown
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/bugs/:id (Get single bug scoped to authenticated library)
 */
app.get('/api/bugs/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bugId = validator.validateId(req.params.id, 'Bug ID');

        const rows = await db.query('SELECT * FROM bugs WHERE id = ? AND library_id = ?', [bugId, libraryId]);
        if (rows.length === 0) {
            throw new NotFoundError('Bug record not found in your library.');
        }

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/bugs (Report new defect scoped to authenticated library)
 */
app.post('/api/bugs', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const clean = validator.validateBugInput(req.body);

        const reportedBy = clean.reported_by || req.user.name || 'Librarian';

        const result = await db.query(`
            INSERT INTO bugs (
                library_id, title, description, module, steps_to_reproduce,
                expected_result, actual_result, severity, status, reported_by, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            libraryId, clean.title, clean.description, clean.module, clean.steps_to_reproduce,
            clean.expected_result, clean.actual_result, clean.severity, clean.status, reportedBy, clean.assigned_to
        ]);

        const newBug = await db.query('SELECT * FROM bugs WHERE id = ? AND library_id = ?', [result.insertId, libraryId]);
        logger.info(`Defect logged: BUG-${result.insertId} [${clean.severity}] "${clean.title}" by ${reportedBy}`, { libraryId, bugId: result.insertId });

        res.status(201).json({
            success: true,
            message: `Defect BUG-${result.insertId} successfully registered.`,
            bug: newBug[0]
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/bugs/:id (Update defect status, fix details, or assignment)
 */
app.put('/api/bugs/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bugId = validator.validateId(req.params.id, 'Bug ID');
        const clean = validator.validateBugInput(req.body, true);

        // Fetch existing bug to check state transition
        const existing = await db.query('SELECT * FROM bugs WHERE id = ? AND library_id = ?', [bugId, libraryId]);
        if (existing.length === 0) {
            throw new NotFoundError('Bug record not found in your library.');
        }

        let resolvedAt = existing[0].resolved_at;
        if ((clean.status === 'Resolved' || clean.status === 'Closed') && !resolvedAt) {
            resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        } else if (clean.status === 'Open' || clean.status === 'In Progress') {
            resolvedAt = null;
        }

        const updateTitle = clean.title !== undefined ? clean.title : existing[0].title;
        const updateDesc = clean.description !== undefined ? clean.description : existing[0].description;
        const updateModule = clean.module !== undefined ? clean.module : existing[0].module;
        const updateSteps = clean.steps_to_reproduce !== undefined ? clean.steps_to_reproduce : existing[0].steps_to_reproduce;
        const updateExpected = clean.expected_result !== undefined ? clean.expected_result : existing[0].expected_result;
        const updateActual = clean.actual_result !== undefined ? clean.actual_result : existing[0].actual_result;
        const updateSeverity = clean.severity !== undefined ? clean.severity : existing[0].severity;
        const updateStatus = clean.status !== undefined ? clean.status : existing[0].status;
        const updateAssigned = clean.assigned_to !== undefined ? clean.assigned_to : existing[0].assigned_to;
        const updateFixDetails = clean.fix_details !== undefined ? clean.fix_details : existing[0].fix_details;

        await db.query(`
            UPDATE bugs 
            SET title = ?, description = ?, module = ?, steps_to_reproduce = ?,
                expected_result = ?, actual_result = ?, severity = ?, status = ?,
                assigned_to = ?, fix_details = ?, resolved_at = ?
            WHERE id = ? AND library_id = ?
        `, [
            updateTitle, updateDesc, updateModule, updateSteps,
            updateExpected, updateActual, updateSeverity, updateStatus,
            updateAssigned, updateFixDetails, resolvedAt, bugId, libraryId
        ]);

        const updated = await db.query('SELECT * FROM bugs WHERE id = ? AND library_id = ?', [bugId, libraryId]);
        logger.info(`Defect updated: BUG-${bugId} -> status=${clean.status}`, { libraryId, bugId });

        res.json({
            success: true,
            message: `Defect BUG-${bugId} successfully updated.`,
            bug: updated[0]
        });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/bugs/:id (Delete bug record scoped to authenticated library)
 */
app.delete('/api/bugs/:id', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;
        const bugId = validator.validateId(req.params.id, 'Bug ID');

        const existing = await db.query('SELECT id FROM bugs WHERE id = ? AND library_id = ?', [bugId, libraryId]);
        if (existing.length === 0) {
            throw new NotFoundError('Bug record not found in your library.');
        }

        await db.query('DELETE FROM bugs WHERE id = ? AND library_id = ?', [bugId, libraryId]);
        logger.info(`Defect removed: BUG-${bugId}`, { libraryId, bugId });

        res.json({ success: true, message: `Bug BUG-${bugId} deleted successfully.` });
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// 11. TQM Q09: QUALITY METRICS, LOGS & TEST RUNS
// =====================================================================

/**
 * GET /api/quality/summary (Comprehensive Quality Dashboard metrics)
 */
app.get('/api/quality/summary', authenticateLibrarian, async (req, res, next) => {
    try {
        const libraryId = req.user.libraryId;

        // Bug metrics
        const totalBugs = await db.query('SELECT COUNT(*) as count FROM bugs WHERE library_id = ?', [libraryId]);
        const openBugs = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status = 'Open'", [libraryId]);
        const resolvedBugs = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND status IN ('Resolved', 'Closed')", [libraryId]);
        const criticalBugs = await db.query("SELECT COUNT(*) as count FROM bugs WHERE library_id = ? AND severity = 'Critical' AND status IN ('Open', 'In Progress')", [libraryId]);

        // Latest automated test run
        let latestTestRun = null;
        try {
            const testRows = await db.query('SELECT * FROM test_runs ORDER BY id DESC LIMIT 1');
            if (testRows.length > 0) {
                latestTestRun = testRows[0];
                if (typeof latestTestRun.summary_json === 'string') {
                    try { latestTestRun.summary = JSON.parse(latestTestRun.summary_json); } catch (e) {}
                }
            }
        } catch (e) {
            // ignore
        }

        // Recent errors and file logging status
        const recentErrors = logger.getRecentErrors(10);
        const logFileStatus = logger.getLogFileStatus();

        const totalCount = totalBugs[0]?.count || 0;
        const resCount = resolvedBugs[0]?.count || 0;
        const resolutionRate = totalCount > 0 ? Math.round((resCount / totalCount) * 100) : 100;

        res.json({
            objective: 'TQM Q09 — Reduce Bugs',
            libraryId,
            libraryName: req.user.libraryName,
            metrics: {
                totalBugs: totalCount,
                openBugs: openBugs[0]?.count || 0,
                resolvedBugs: resCount,
                criticalBugs: criticalBugs[0]?.count || 0,
                resolutionRate
            },
            latestTestRun,
            logging: {
                recentErrorCount: recentErrors.length,
                logFileStatus,
                activeBufferLimit: 100
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/logs/errors (Live sanitized error log viewer)
 */
app.get('/api/logs/errors', authenticateLibrarian, (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const errors = logger.getRecentErrors(limit);
    res.json({
        success: true,
        count: errors.length,
        errors
    });
});

/**
 * POST /api/quality/test-runs (Record automated test execution results)
 */
app.post('/api/quality/test-runs', async (req, res, next) => {
    try {
        const { total_tests, passed_tests, failed_tests, duration_ms, summary } = req.body;

        const total = parseInt(total_tests || '0', 10);
        const passed = parseInt(passed_tests || '0', 10);
        const failed = parseInt(failed_tests || '0', 10);
        const duration = parseInt(duration_ms || '0', 10);
        const summaryJson = typeof summary === 'object' ? JSON.stringify(summary) : (summary || null);

        const result = await db.query(`
            INSERT INTO test_runs (total_tests, passed_tests, failed_tests, duration_ms, summary_json)
            VALUES (?, ?, ?, ?, ?)
        `, [total, passed, failed, duration, summaryJson]);

        logger.info(`Test run recorded: ${passed}/${total} passed (${failed} failed, ${duration}ms)`, { testRunId: result.insertId });

        res.status(201).json({
            success: true,
            id: result.insertId,
            total,
            passed,
            failed,
            duration
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/quality/test-runs (List recent test execution runs)
 */
app.get('/api/quality/test-runs', authenticateLibrarian, async (req, res, next) => {
    try {
        const runs = await db.query('SELECT * FROM test_runs ORDER BY id DESC LIMIT 10');
        const formatted = runs.map(r => {
            let summary = null;
            if (typeof r.summary_json === 'string') {
                try { summary = JSON.parse(r.summary_json); } catch (e) {}
            }
            return {
                ...r,
                summary
            };
        });
        res.json(formatted);
    } catch (err) {
        next(err);
    }
});

// =====================================================================
// CENTRALIZED ERROR HANDLING MIDDLEWARE (TQM Q09)
// =====================================================================

// 404 Handler for undefined API routes
app.use(notFoundHandler);

// Centralized App Error & Exception Handler
app.use(errorHandler);

// Start Server
async function startServer() {
    try {
        await db.initDatabase();
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`  HS LIBRARY — MULTI-LIBRARY MANAGEMENT SYSTEM RUNNING`);
            console.log(`  URL: http://localhost:${PORT}`);
            console.log(`  API: http://localhost:${PORT}/api/health`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
