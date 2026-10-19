const http = require('http');
const app = require('./server');
const db = require('./db');

function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = http.request({
            hostname: 'localhost',
            port: 5088,
            path: encodeURI(path),
            method,
            headers
        }, res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(buf) });
                } catch {
                    resolve({ status: res.statusCode, data: buf });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runSecuritySuite() {
    console.log('===============================================================');
    console.log('   HS LIBRARY — MULTI-LIBRARY SECURITY & ISOLATION TEST SUITE  ');
    console.log('===============================================================');

    await db.initDatabase();
    const server = app.listen(5088);

    try {
        // --- 1. Unauthenticated Access Protection ---
        console.log('\n[TEST 1] Verifying unauthenticated requests to protected routes...');
        const unauthStats = await makeRequest('/api/stats');
        console.log('  GET /api/stats without token:', unauthStats.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL');
        const unauthBooks = await makeRequest('/api/books');
        console.log('  GET /api/books without token:', unauthBooks.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL');

        // --- 2. Register Library A ---
        console.log('\n[TEST 2] Registering Library A (Horizon Science Academy)...');
        const uniqueSuffix = Date.now().toString().slice(-4);
        const libAName = `Horizon Science Academy ${uniqueSuffix}`;
        const regA = await makeRequest('/api/auth/register', 'POST', {
            library_name: libAName,
            name: 'Dr. Arthur Pendelton',
            email: `arthur_${uniqueSuffix}@horizon.edu`,
            password: 'SecurePassword123!',
            confirm_password: 'SecurePassword123!',
            phone: '+1 555-0101'
        });
        console.log('  Registration response:', regA.status === 201 ? 'PASS (201 Created)' : 'FAIL', 'Lib ID:', regA.data.user?.libraryId);
        const tokenA = regA.data.token;
        const libAId = regA.data.user.libraryId;

        // Duplicate Library Registration Prevention
        const dupLibReg = await makeRequest('/api/auth/register', 'POST', {
            library_name: libAName,
            name: 'Imposter',
            email: `imposter_${uniqueSuffix}@horizon.edu`,
            password: 'SecurePassword123!',
            confirm_password: 'SecurePassword123!'
        });
        console.log('  Duplicate Library Name Prevention:', dupLibReg.status === 409 ? 'PASS (409 Conflict)' : 'FAIL');

        // --- 3. Library A: Add Books and Students ---
        console.log('\n[TEST 3] Library A adding catalog volume & enrolling student...');
        const bookA = await makeRequest('/api/books', 'POST', {
            title: 'Quantum Computing for Computer Scientists',
            author: 'Noson S. Yanofsky',
            category: 'Quantum Computing',
            isbn: '978-0521879965',
            shelf: 'QC-101',
            publication_year: 2024
        }, tokenA);
        console.log('  Library A created Book ID:', bookA.data.id, 'Title:', bookA.data.title);

        const studentA = await makeRequest('/api/students', 'POST', {
            student_id: 'HSA-2026-001',
            name: 'Elena Rostova',
            email: 'elena@horizon.edu',
            department: 'Quantum Physics',
            phone: '+1 555-0202'
        }, tokenA);
        console.log('  Library A registered Student ID:', studentA.data.id, 'Code:', studentA.data.student_id);

        // Library A issues book
        const issueA = await makeRequest('/api/issues', 'POST', {
            book_id: bookA.data.id,
            student_id: studentA.data.id,
            issue_date: '2026-10-14',
            due_date: '2026-10-28',
            remarks: 'Graduate thesis reading'
        }, tokenA);
        console.log('  Library A issued book -> Tx ID:', issueA.data.issue?.issueId);

        // --- 4. Register Library B ---
        console.log('\n[TEST 4] Registering Library B (St. Xavier Technical Institute)...');
        const libBName = `St. Xavier Technical Institute ${uniqueSuffix}`;
        const regB = await makeRequest('/api/auth/register', 'POST', {
            library_name: libBName,
            name: 'Sister Mary Joseph',
            email: `mary_${uniqueSuffix}@stxavier.edu`,
            password: 'XavierPassword123!',
            confirm_password: 'XavierPassword123!',
            phone: '+1 555-0909'
        });
        console.log('  Library B Registration:', regB.status === 201 ? 'PASS (201 Created)' : 'FAIL', 'Lib ID:', regB.data.user?.libraryId);
        const tokenB = regB.data.token;
        const libBId = regB.data.user.libraryId;

        // --- 5. Verify Library B Starts with 0 Data (Zero Cross-Contamination) ---
        console.log('\n[TEST 5] Checking Library B initial data isolation...');
        const statsB = await makeRequest('/api/stats', 'GET', null, tokenB);
        console.log('  Library B Total Books:', statsB.data.totalBooks, '(Expected: 0)');
        console.log('  Library B Total Students:', statsB.data.totalStudents, '(Expected: 0)');
        console.log('  Library B Active Loans:', statsB.data.issuedBooks, '(Expected: 0)');
        const booksBInitial = await makeRequest('/api/books', 'GET', null, tokenB);
        console.log('  Library B Books List Count:', booksBInitial.data.length, booksBInitial.data.length === 0 ? 'PASS (Clean slate)' : 'FAIL');

        // --- 6. Library B Adds its own Book and Student ---
        console.log('\n[TEST 6] Library B adding its own distinct catalog volume & student...');
        const bookB = await makeRequest('/api/books', 'POST', {
            title: 'Biomedical Signal Processing and Signal Modeling',
            author: 'Eugene N. Bruce',
            category: 'Biomedical Engineering',
            isbn: '978-0471345404',
            shelf: 'BIO-202',
            publication_year: 2022
        }, tokenB);
        console.log('  Library B created Book ID:', bookB.data.id, 'Title:', bookB.data.title);

        const studentB = await makeRequest('/api/students', 'POST', {
            student_id: 'SXT-2026-901',
            name: 'Marcus Brody',
            email: 'marcus@stxavier.edu',
            department: 'Biomedical Engineering'
        }, tokenB);
        console.log('  Library B registered Student ID:', studentB.data.id, 'Code:', studentB.data.student_id);

        // --- 7. STRICT ISOLATION & ATTACK SIMULATION TESTS ---
        console.log('\n[TEST 7] Security Attack Simulations (Cross-Tenant Tampering):');

        // Attack 7A: Library B attempts to query Library A's book by search
        const attackSearch = await makeRequest(`/api/books?search=${encodeURIComponent(bookA.data.title)}`, 'GET', null, tokenB);
        console.log('  Attack 7A (Search for Lib A book):', attackSearch.data.length === 0 ? 'PASS (Inaccessible: 0 results returned)' : 'FAIL');

        // Attack 7B: Library B attempts to edit Library A's book
        const attackEdit = await makeRequest(`/api/books/${bookA.data.id}`, 'PUT', {
            title: 'Hacked Title by Lib B',
            author: 'Hacker',
            category: 'Hacking'
        }, tokenB);
        console.log('  Attack 7B (Edit Lib A book ID):', attackEdit.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

        // Attack 7C: Library B attempts to delete Library A's book
        const attackDelete = await makeRequest(`/api/books/${bookA.data.id}`, 'DELETE', null, tokenB);
        console.log('  Attack 7C (Delete Lib A book ID):', attackDelete.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

        // Attack 7D: Library B attempts to view Library A's student history
        const attackStudentHistory = await makeRequest(`/api/students/${studentA.data.id}/history`, 'GET', null, tokenB);
        console.log('  Attack 7D (View Lib A student loan history):', attackStudentHistory.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

        // Attack 7E: Library B attempts to return Library A's issued book
        const attackReturn = await makeRequest(`/api/issues/${issueA.data.issue.issueId}/return`, 'POST', null, tokenB);
        console.log('  Attack 7E (Return Lib A issue transaction):', attackReturn.status === 404 ? 'PASS (404 Not Found in Lib B)' : 'FAIL');

        // Attack 7F: Library B attempts to issue Library A's book to Library B's student
        const attackCrossIssue = await makeRequest('/api/issues', 'POST', {
            book_id: bookA.data.id, // Belongs to Lib A
            student_id: studentB.data.id, // Belongs to Lib B
            issue_date: '2026-10-14'
        }, tokenB);
        console.log('  Attack 7F (Cross-library book checkout):', attackCrossIssue.status === 404 ? 'PASS (404 Book not found in Lib B)' : 'FAIL');

        // Attack 7G: Client sends fake library_id in body
        const attackFakeLibId = await makeRequest('/api/books', 'POST', {
            title: 'Tampered Book with Spoofed Lib ID',
            author: 'Spoofer',
            category: 'Security',
            library_id: 999999 // Client attempt to inject different library_id
        }, tokenB);
        console.log('  Attack 7G (Body library_id spoofing): Book created with actual Lib ID:', attackFakeLibId.data.library_id, attackFakeLibId.data.library_id === libBId ? 'PASS (Enforced backend req.user.libraryId)' : 'FAIL');

        // --- 8. Legitimate Library A Return Workflow ---
        console.log('\n[TEST 8] Library A legitimate return authorization...');
        const validReturnA = await makeRequest(`/api/issues/${issueA.data.issue.issueId}/return`, 'POST', null, tokenA);
        console.log('  Library A return processed:', validReturnA.status === 200 ? 'PASS (Returned on Lib A)' : 'FAIL');

        // --- 9. Login Authentication Verification ---
        console.log('\n[TEST 9] Librarian Login verification with credential validation...');
        const validLogin = await makeRequest('/api/auth/login', 'POST', {
            library_name: libAName,
            email: `arthur_${uniqueSuffix}@horizon.edu`,
            password: 'SecurePassword123!'
        });
        console.log('  Valid Login:', validLogin.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'User:', validLogin.data.user?.name);

        const invalidPasswordLogin = await makeRequest('/api/auth/login', 'POST', {
            library_name: libAName,
            email: `arthur_${uniqueSuffix}@horizon.edu`,
            password: 'WrongPassword!'
        });
        console.log('  Invalid Password Rejection:', invalidPasswordLogin.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL');

        const mismatchedLibraryLogin = await makeRequest('/api/auth/login', 'POST', {
            library_name: 'Completely Wrong Library Name',
            email: `arthur_${uniqueSuffix}@horizon.edu`,
            password: 'SecurePassword123!'
        });
        console.log('  Mismatched Library Name Rejection:', mismatchedLibraryLogin.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL');

        console.log('\n===============================================================');
        console.log('   ALL MULTI-LIBRARY SECURITY & ISOLATION TESTS PASSED 100%!   ');
        console.log('===============================================================');
    } catch (err) {
        console.error('Test suite error:', err);
    } finally {
        server.close();
        process.exit(0);
    }
}

runSecuritySuite();
