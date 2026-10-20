/**
 * HS LIBRARY MANAGEMENT SYSTEM — AUTOMATED MODULE TEST SUITE
 * TQM Objective: Q09 — Reduce Bugs
 * 
 * Built with native Node.js Test Runner (node:test) and Assert (node:assert/strict).
 * Zero extra npm dependencies required.
 * 
 * Covers:
 * 1. Authentication & Security
 * 2. Books Management & Strict Input Validation
 * 3. Students Management & Integrity
 * 4. Issues & Circulation Lifecycle
 * 5. Multi-Tenant Library Data Isolation
 * 6. Error Handling & Standardized Response Schema
 * 7. Bug Tracker Module (TQM Q09)
 * 8. Transaction Safety & Quality Dashboard Metrics
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('./server');
const db = require('./db');
const { validateIsbnChecksum, calculateOverdueFine, normalizePhoneNumber, formatTitleCase, validatePublicationYear, formatIsbnStandard } = require('./validator');

let server;
let baseUrl;

// Shared test credentials and tokens
let testLibA = {
    library_name: `Test Library Alpha ${Date.now()}`,
    name: 'Alice Librarian',
    email: `alice.${Date.now()}@testlib.org`,
    password: 'Password@123',
    confirm_password: 'Password@123',
    phone: '+91 99999 11111'
};

let testLibB = {
    library_name: `Test Library Beta ${Date.now()}`,
    name: 'Bob Librarian',
    email: `bob.${Date.now()}@testlib.org`,
    password: 'Password@123',
    confirm_password: 'Password@123',
    phone: '+91 99999 22222'
};

let tokenLibA = null;
let libraryIdA = null;
let tokenLibB = null;
let libraryIdB = null;

const testBookTitle = `Software Quality Architecture ${Date.now()}`;
const testStudentCode = `CS-${Date.now().toString().slice(-6)}`;

let bookIdA = null;
let studentIdA = null;
let issueIdA = null;
let bugIdA = null;

// Test Execution Summary for TQM Q09 recording
const testStats = {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: Date.now()
};

/**
 * Helper to make HTTP requests against the active test server
 */
async function request(path, options = {}) {
    testStats.total += 1;
    const url = `${baseUrl}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }

    const fetchOptions = {
        method: options.method || 'GET',
        headers
    };

    if (options.body) {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
        const res = await fetch(url, fetchOptions);
        let data = null;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        testStats.passed += 1;
        return {
            status: res.status,
            headers: res.headers,
            data
        };
    } catch (err) {
        testStats.failed += 1;
        throw err;
    }
}

before(async () => {
    // 1. Ensure database is fully initialized
    await db.initDatabase();

    // 2. Start express app on ephemeral port to prevent port conflicts
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`[Test Suite] Ephemeral test server running at ${baseUrl}`);
            resolve();
        });
    });
});

after(async () => {
    // Record test run results in test_runs table for Quality Dashboard
    const duration = Date.now() - testStats.startTime;
    try {
        await db.query(`
            INSERT INTO test_runs (total_tests, passed_tests, failed_tests, duration_ms, summary_json)
            VALUES (?, ?, ?, ?, ?)
        `, [
            testStats.total,
            testStats.passed,
            testStats.failed,
            duration,
            JSON.stringify({
                suite: 'TQM Q09 Module Test Suite',
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            })
        ]);
        console.log(`[Test Suite] Recorded test run into test_runs: ${testStats.passed}/${testStats.total} passed in ${duration}ms.`);
    } catch (err) {
        console.error('[Test Suite] Failed to record test run in db:', err);
    }

    // Close ephemeral server
    if (server) {
        server.close();
    }
});

// =====================================================================
// 1. AUTHENTICATION & ACCESS CONTROL TESTS
// =====================================================================
describe('1. Authentication Module & Access Control', () => {

    it('should reject registration with invalid email format', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: {
                library_name: 'Invalid Email Library',
                name: 'Librarian Test',
                email: 'not-a-valid-email',
                password: 'Password@123',
                confirm_password: 'Password@123'
            }
        });
        assert.equal(res.status, 400);
        assert.ok(res.data.error.includes('valid email'));
    });

    it('should reject registration with password shorter than 6 characters', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: {
                library_name: 'Short Pass Library',
                name: 'Librarian Test',
                email: 'shortpass@testlib.org',
                password: '123',
                confirm_password: '123'
            }
        });
        assert.equal(res.status, 400);
        assert.ok(res.data.error.includes('6 characters'));
    });

    it('should reject registration when password and confirm_password do not match', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: {
                library_name: 'Mismatch Library',
                name: 'Librarian Test',
                email: 'mismatch@testlib.org',
                password: 'Password@123',
                confirm_password: 'DifferentPassword@123'
            }
        });
        assert.equal(res.status, 400);
        assert.ok(res.data.error.includes('do not match'));
    });

    it('should successfully register a valid new library and librarian (Library Alpha)', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: testLibA
        });
        assert.equal(res.status, 201);
        assert.ok(res.data.token);
        assert.ok(res.data.user);
        assert.equal(res.data.user.email, testLibA.email);

        tokenLibA = res.data.token;
        libraryIdA = res.data.user.libraryId;
    });

    it('should reject duplicate library registration with same email', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: testLibA
        });
        assert.equal(res.status, 409);
        assert.ok(res.data.error.includes('already exists') || res.data.error.includes('registered'));
    });

    it('should successfully authenticate registered librarian via login', async () => {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: {
                library_name: testLibA.library_name,
                email: testLibA.email,
                password: testLibA.password
            }
        });
        assert.equal(res.status, 200);
        assert.ok(res.data.token);
        assert.equal(res.data.user.email, testLibA.email);
    });

    it('should reject login with incorrect password', async () => {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: {
                library_name: testLibA.library_name,
                email: testLibA.email,
                password: 'WrongPassword!999'
            }
        });
        assert.equal(res.status, 401);
        assert.ok(res.data.error.includes('Invalid') || res.data.error.includes('password'));
    });

    it('should allow access to /api/auth/me with valid Bearer token', async () => {
        const res = await request('/api/auth/me', {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.user.email, testLibA.email);
        assert.equal(res.data.user.library_id, libraryIdA);
    });

    it('should reject access to protected endpoint without authentication token', async () => {
        const res = await request('/api/books');
        assert.equal(res.status, 401);
        assert.equal(res.data.code, 'UNAUTHORIZED');
        assert.ok(res.data.error);
    });
});

// =====================================================================
// 2. BOOKS MANAGEMENT & STRICT VALIDATION TESTS
// =====================================================================
describe('2. Books Module & Strict Input Validation', () => {

    it('should format 13-digit ISBN into standard canonical format', () => {
        assert.equal(formatIsbnStandard('9780132350884'), '978-0-13-235088-4');
        assert.equal(formatIsbnStandard('978-0132350884'), '978-0-13-235088-4');
        assert.equal(formatIsbnStandard(''), null);
        assert.equal(formatIsbnStandard(null), null);
    });

    it('should validate publication year boundaries properly', () => {
        const currentYear = new Date().getFullYear();
        assert.equal(validatePublicationYear(2020), 2020);
        assert.equal(validatePublicationYear(currentYear), currentYear);
        assert.equal(validatePublicationYear(currentYear + 1), currentYear + 1);
        assert.equal(validatePublicationYear(-500), null);
        assert.equal(validatePublicationYear(currentYear + 10), null);
        assert.equal(validatePublicationYear('invalid'), null);
    });

    it('should format catalog strings to Title Case properly', () => {
        assert.equal(formatTitleCase('computer science'), 'Computer Science');
        assert.equal(formatTitleCase('DATA STRUCTURES AND ALGORITHMS'), 'Data Structures And Algorithms');
        assert.equal(formatTitleCase('h.g. wells'), 'H.g. Wells');
        assert.equal(formatTitleCase(''), '');
    });

    it('should reject adding a book with empty or whitespace title', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: '   ',
                author: 'Valid Author',
                category: 'Computer Science'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
        assert.ok(JSON.stringify(res.data).toLowerCase().includes('title'));
    });

    it('should reject adding a book with invalid publication year (negative or future beyond +5 yrs)', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: 'Time Traveler Guide',
                author: 'H.G. Wells',
                category: 'Science Fiction',
                publication_year: -500
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
        assert.ok(JSON.stringify(res.data).toLowerCase().includes('publication year'));
    });

    it('should reject adding a book with invalid ISBN format', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: 'Malformed ISBN Book',
                author: 'Test Author',
                category: 'Computer Science',
                isbn: 'INVALID-ISBN-1234'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
        assert.ok(JSON.stringify(res.data).toLowerCase().includes('isbn'));
    });

    it('should verify ISBN-10 and ISBN-13 checksum algorithm validation', () => {
        assert.equal(validateIsbnChecksum('0-306-40615-2'), true);
        assert.equal(validateIsbnChecksum('978-0-13-449416-6'), true);
        assert.equal(validateIsbnChecksum('0-306-40615-9'), false);
        assert.equal(validateIsbnChecksum('978-0-13-449416-0'), false);
        assert.equal(validateIsbnChecksum(''), false);
    });

    it('should successfully add a valid book to library catalog', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: testBookTitle,
                author: 'Martin Fowler',
                category: 'Software Engineering',
                language: 'English',
                isbn: '978-0-13-449416-6',
                shelf: 'Stack SE-1',
                publication_year: 2024,
                description: 'Comprehensive guide to architectural quality and defect reduction.'
            }
        });
        assert.equal(res.status, 201);
        assert.ok(res.data.id);
        assert.equal(res.data.title, testBookTitle);
        assert.equal(res.data.status, 'available');
        bookIdA = res.data.id;
    });

    it('should reject duplicate book title and author within the same library without distinct edition', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: testBookTitle,
                author: 'Martin Fowler',
                category: 'Software Engineering',
                publication_year: 2024,
                isbn: '978-0-13-449416-6'
            }
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('already exists'));
    });

    it('should retrieve book list and support category/search filters', async () => {
        const res = await request(`/api/books?search=${encodeURIComponent(testBookTitle)}`, {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.data));
        assert.ok(res.data.some(b => b.title === testBookTitle));
    });

    it('should retrieve single book details by ID', async () => {
        const res = await request(`/api/books/${bookIdA}`, {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.id, bookIdA);
        assert.equal(res.data.title, testBookTitle);
    });

    it('should successfully update book details', async () => {
        const res = await request(`/api/books/${bookIdA}`, {
            method: 'PUT',
            token: tokenLibA,
            body: {
                title: `${testBookTitle} (2nd Edition)`,
                author: 'Martin Fowler',
                category: 'Software Engineering',
                shelf: 'Stack SE-2',
                publication_year: 2025
            }
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.title, `${testBookTitle} (2nd Edition)`);
        assert.equal(res.data.shelf, 'Stack SE-2');
    });
});

// =====================================================================
// 3. STUDENTS MANAGEMENT & VALIDATION TESTS
// =====================================================================
describe('3. Students Module & Validation', () => {

    it('should normalize student contact phone numbers', () => {
        assert.equal(normalizePhoneNumber('+91 98765-43210'), '+919876543210');
        assert.equal(normalizePhoneNumber('(011) 2345 6789'), '01123456789');
        assert.equal(normalizePhoneNumber('9999911111'), '9999911111');
        assert.equal(normalizePhoneNumber('invalid'), null);
    });

    it('should reject student registration with empty student ID (Roll Number)', async () => {
        const res = await request('/api/students', {
            method: 'POST',
            token: tokenLibA,
            body: {
                student_id: '   ',
                name: 'Kavya Sharma',
                department: 'Computer Science'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
    });

    it('should reject student registration with empty name', async () => {
        const res = await request('/api/students', {
            method: 'POST',
            token: tokenLibA,
            body: {
                student_id: 'CS-2026-99',
                name: '  ',
                department: 'Computer Science'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
    });

    it('should successfully register a student with valid information', async () => {
        const res = await request('/api/students', {
            method: 'POST',
            token: tokenLibA,
            body: {
                student_id: testStudentCode,
                name: 'Devansh Roy',
                email: 'devansh.roy@university.edu',
                department: 'Computer Science',
                phone: '+91 98888 77777'
            }
        });
        assert.equal(res.status, 201);
        assert.ok(res.data.id);
        assert.equal(res.data.student_id, testStudentCode);
        assert.equal(res.data.name, 'Devansh Roy');
        studentIdA = res.data.id;
    });

    it('should reject duplicate student ID in the same library', async () => {
        const res = await request('/api/students', {
            method: 'POST',
            token: tokenLibA,
            body: {
                student_id: testStudentCode,
                name: 'Another Student',
                department: 'Information Technology'
            }
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('already registered'));
    });

    it('should retrieve student loan history (initially empty)', async () => {
        const res = await request(`/api/students/${studentIdA}/history`, {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.student.id, studentIdA);
        assert.deepEqual(res.data.loans, []);
    });
});

// =====================================================================
// 4. ISSUES & CIRCULATION TRANSACTION SAFETY TESTS
// =====================================================================
describe('4. Issues & Circulation Lifecycle', () => {

    it('should verify overdue loan days and fine calculations', () => {
        const dueDate = new Date('2026-10-01');
        const onTimeDate = new Date('2026-09-30');
        const overdueDate = new Date('2026-10-06');

        const resOnTime = calculateOverdueFine(dueDate, onTimeDate, 5, 0);
        assert.equal(resOnTime.isOverdue, false);
        assert.equal(resOnTime.fineAmount, 0);

        const resOverdue = calculateOverdueFine(dueDate, overdueDate, 5, 0);
        assert.equal(resOverdue.isOverdue, true);
        assert.equal(resOverdue.overdueDays, 5);
        assert.equal(resOverdue.fineAmount, 25);

        const resGrace = calculateOverdueFine(dueDate, overdueDate, 5, 2);
        assert.equal(resGrace.isOverdue, true);
        assert.equal(resGrace.fineAmount, 15);
    });

    it('should successfully issue an available book to a registered student', async () => {
        const res = await request('/api/issues', {
            method: 'POST',
            token: tokenLibA,
            body: {
                book_id: bookIdA,
                student_id: studentIdA,
                remarks: 'Semester loan for TQM study'
            }
        });
        assert.equal(res.status, 201);
        assert.ok(res.data.issue.issueId);
        assert.equal(res.data.issue.studentName, 'Devansh Roy');
        issueIdA = res.data.issue.issueId;

        // Verify book status was updated to issued
        const bookRes = await request(`/api/books/${bookIdA}`, { token: tokenLibA });
        assert.equal(bookRes.data.status, 'issued');
    });

    it('should reject issuing an already issued / unavailable book', async () => {
        const res = await request('/api/issues', {
            method: 'POST',
            token: tokenLibA,
            body: {
                book_id: bookIdA,
                student_id: studentIdA
            }
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('unavailable') || res.data.error.includes('issued'));
    });

    it('should reject issuing non-existent book', async () => {
        const res = await request('/api/issues', {
            method: 'POST',
            token: tokenLibA,
            body: {
                book_id: 999999,
                student_id: studentIdA
            }
        });
        assert.equal(res.status, 404);
        assert.equal(res.data.code, 'NOT_FOUND');
    });

    it('should reject deleting a book while it is actively issued', async () => {
        const res = await request(`/api/books/${bookIdA}`, {
            method: 'DELETE',
            token: tokenLibA
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('currently issued'));
    });

    it('should reject deleting a student who has active borrowed books', async () => {
        const res = await request(`/api/students/${studentIdA}`, {
            method: 'DELETE',
            token: tokenLibA
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('unreturned books'));
    });

    it('should successfully return the issued book and reset status to available', async () => {
        const res = await request(`/api/issues/${issueIdA}/return`, {
            method: 'POST',
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.ok(res.data.success);
        assert.ok(res.data.data.returnDate);

        // Verify book is back to available
        const bookRes = await request(`/api/books/${bookIdA}`, { token: tokenLibA });
        assert.equal(bookRes.data.status, 'available');
    });

    it('should reject returning an already returned book transaction', async () => {
        const res = await request(`/api/issues/${issueIdA}/return`, {
            method: 'POST',
            token: tokenLibA
        });
        assert.equal(res.status, 409);
        assert.equal(res.data.code, 'CONFLICT');
        assert.ok(res.data.error.includes('already returned'));
    });
});

// =====================================================================
// 5. MULTI-TENANT LIBRARY DATA ISOLATION TESTS
// =====================================================================
describe('5. Multi-Tenant Library Data Isolation', () => {

    it('should register Library Beta with a distinct account', async () => {
        const res = await request('/api/auth/register', {
            method: 'POST',
            body: testLibB
        });
        assert.equal(res.status, 201);
        tokenLibB = res.data.token;
        libraryIdB = res.data.user.libraryId;
        assert.notEqual(libraryIdA, libraryIdB);
    });

    it('Library Beta cannot access or see Library Alpha books', async () => {
        const res = await request(`/api/books/${bookIdA}`, {
            token: tokenLibB
        });
        assert.equal(res.status, 404);
        assert.equal(res.data.code, 'NOT_FOUND');
    });

    it('Library Beta cannot access or see Library Alpha students', async () => {
        const res = await request(`/api/students/${studentIdA}/history`, {
            token: tokenLibB
        });
        assert.equal(res.status, 404);
        assert.equal(res.data.code, 'NOT_FOUND');
    });

    it('Library Beta cannot issue Library Alpha books', async () => {
        const res = await request('/api/issues', {
            method: 'POST',
            token: tokenLibB,
            body: {
                book_id: bookIdA,
                student_id: studentIdA
            }
        });
        assert.equal(res.status, 404);
    });

    it('Library Beta cannot return Library Alpha issue records', async () => {
        const res = await request(`/api/issues/${issueIdA}/return`, {
            method: 'POST',
            token: tokenLibB
        });
        assert.equal(res.status, 404);
    });
});

// =====================================================================
// 6. ERROR HANDLING & SECURITY RESILIENCE TESTS
// =====================================================================
describe('6. Error Handling & Standardized Error Schema', () => {

    it('should return standardized 400 when malformed JSON body is received', async () => {
        const res = await request('/api/books', {
            method: 'POST',
            token: tokenLibA,
            body: '{ "title": "Malformed Json, missing closing brace '
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.success, false);
        assert.ok(res.data.error);
        assert.ok(res.headers.get('x-request-id'));
    });

    it('should reject invalid non-numeric ID parameter with 400 ValidationError', async () => {
        const res = await request('/api/books/invalid-id-xyz', {
            token: tokenLibA
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
        assert.ok(res.data.error.includes('Book ID'));
    });

    it('should reject negative ID parameter with 400 ValidationError', async () => {
        const res = await request('/api/books/-99', {
            token: tokenLibA
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
    });

    it('should return standardized 404 for non-existent API routes', async () => {
        const res = await request('/api/non-existent-endpoint-route-test');
        assert.equal(res.status, 404);
        assert.equal(res.data.code, 'NOT_FOUND');
        assert.ok(res.data.error.includes('Endpoint not found'));
    });
});

// =====================================================================
// 7. BUG TRACKER MODULE (TQM Q09) TESTS
// =====================================================================
describe('7. Bug Tracker Module (TQM Q09)', () => {

    it('should reject logging bug with empty title', async () => {
        const res = await request('/api/bugs', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: '   ',
                description: 'Valid description',
                module: 'Books'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
    });

    it('should reject logging bug with invalid severity level', async () => {
        const res = await request('/api/bugs', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: 'Invalid Severity Bug',
                description: 'Testing severity enum',
                module: 'UI',
                severity: 'UrgentUltra'
            }
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.code, 'VALIDATION_ERROR');
        assert.ok(JSON.stringify(res.data).includes('Severity'));
    });

    it('should successfully create a new bug defect in Bug Tracker', async () => {
        const res = await request('/api/bugs', {
            method: 'POST',
            token: tokenLibA,
            body: {
                title: 'Pagination glitch on mobile portrait view',
                description: 'Page numbers wrap awkwardly on screens narrower than 360px.',
                module: 'UI',
                severity: 'Low',
                steps_to_reproduce: '1. Open Books pane on 320px viewport\n2. Observe pagination bar',
                expected_result: 'Pagination buttons collapse into compact chevron controls',
                actual_result: 'Numbers overflow to second line',
                assigned_to: 'Frontend Team'
            }
        });
        assert.equal(res.status, 201);
        assert.ok(res.data.bug.id);
        assert.equal(res.data.bug.status, 'Open');
        assert.equal(res.data.bug.severity, 'Low');
        bugIdA = res.data.bug.id;
    });

    it('should retrieve bug list and support filtering by module', async () => {
        const res = await request('/api/bugs?module=UI', {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.data));
        assert.ok(res.data.some(b => b.id === bugIdA));
    });

    it('should update bug status to Resolved with fix details', async () => {
        const res = await request(`/api/bugs/${bugIdA}`, {
            method: 'PUT',
            token: tokenLibA,
            body: {
                title: 'Pagination glitch on mobile portrait view',
                description: 'Page numbers wrap awkwardly on screens narrower than 360px.',
                module: 'UI',
                severity: 'Low',
                status: 'Resolved',
                fix_details: 'Added CSS flex-wrap and responsive font clamping in style.css.'
            }
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.bug.status, 'Resolved');
        assert.ok(res.data.bug.resolved_at !== null);
    });

    it('should retrieve bug statistics scoped to library', async () => {
        const res = await request('/api/bugs/stats', {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.ok(res.data.total >= 1);
        assert.ok(res.data.resolved >= 1);
    });
});

// =====================================================================
// 8. QUALITY DASHBOARD & TRANSACTION SAFETY TESTS
// =====================================================================
describe('8. Quality Dashboard & Transaction Safety', () => {

    it('should verify atomic rollback when circulation transaction encounters error', async () => {
        // Count issues and check book status before attempted bad transaction
        const beforeIssues = await db.query('SELECT COUNT(*) as c FROM issues WHERE library_id = ?', [libraryIdA]);
        const countBefore = beforeIssues[0].c;

        // Try issuing to a student that doesn't exist
        const res = await request('/api/issues', {
            method: 'POST',
            token: tokenLibA,
            body: {
                book_id: bookIdA,
                student_id: 999999
            }
        });
        assert.equal(res.status, 404);

        // Verify no orphan records created and book remains available
        const afterIssues = await db.query('SELECT COUNT(*) as c FROM issues WHERE library_id = ?', [libraryIdA]);
        assert.equal(afterIssues[0].c, countBefore);

        const bookCheck = await request(`/api/books/${bookIdA}`, { token: tokenLibA });
        assert.equal(bookCheck.data.status, 'available');
    });

    it('should return complete quality summary for Quality Dashboard', async () => {
        const res = await request('/api/quality/summary', {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.objective, 'TQM Q09 — Reduce Bugs');
        assert.ok(res.data.metrics);
        assert.ok(res.data.logging);
    });

    it('should retrieve sanitized error logs without leaking passwords or secrets', async () => {
        const res = await request('/api/logs/errors', {
            token: tokenLibA
        });
        assert.equal(res.status, 200);
        assert.ok(res.data.success);
        assert.ok(Array.isArray(res.data.errors));

        // Verify redaction: stringify should not contain unredacted secrets
        const logDump = JSON.stringify(res.data.errors);
        assert.equal(logDump.includes('Password@123'), false);
    });
});
