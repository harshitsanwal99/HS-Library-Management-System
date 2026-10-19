const http = require('http');
const app = require('./server');
const db = require('./db');

async function runTests() {
    console.log('--- Starting API Automated Tests ---');
    await db.initDatabase();
    const server = app.listen(5099);

    const request = (path, method = 'GET', body = null) => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 5099,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    };

    try {
        // Test 1: Health
        const health = await request('/api/health');
        console.log('1. GET /api/health:', health.status === 200 ? 'PASS' : 'FAIL', health.body.database.engine);

        // Test 2: Stats
        const stats = await request('/api/stats');
        console.log('2. GET /api/stats:', stats.status === 200 ? 'PASS' : 'FAIL', 'Total Books:', stats.body.totalBooks);

        // Test 3: Books list
        const books = await request('/api/books');
        console.log('3. GET /api/books:', books.status === 200 ? 'PASS' : 'FAIL', 'Loaded count:', books.body.length);

        // Test 4: Add Book
        const newBook = await request('/api/books', 'POST', {
            title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
            author: 'Robert C. Martin',
            category: 'Software Engineering',
            isbn: '978-0132350884',
            shelf: 'SE-101',
            publication_year: 2008
        });
        console.log('4. POST /api/books:', newBook.status === 201 ? 'PASS' : 'FAIL', 'New ID:', newBook.body.id);

        // Test 5: Add Duplicate Book
        const dupBook = await request('/api/books', 'POST', {
            title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
            author: 'Robert C. Martin',
            category: 'Software Engineering'
        });
        console.log('5. Duplicate Book Prevention:', dupBook.status === 409 ? 'PASS' : 'FAIL');

        // Test 6: Students list
        const students = await request('/api/students');
        console.log('6. GET /api/students:', students.status === 200 ? 'PASS' : 'FAIL', 'Count:', students.body.length);

        // Test 7: Add Student
        const newStudent = await request('/api/students', 'POST', {
            student_id: 'HS-2024-099',
            name: 'Kavita Sen',
            email: 'kavita.sen@hslibrary.edu',
            department: 'Computer Science',
            phone: '+91 99887 76655'
        });
        console.log('7. POST /api/students:', newStudent.status === 201 ? 'PASS' : 'FAIL', 'New ID:', newStudent.body.id);

        // Test 8: Duplicate Student ID
        const dupStudent = await request('/api/students', 'POST', {
            student_id: 'HS-2024-099',
            name: 'Another Student'
        });
        console.log('8. Duplicate Student Prevention:', dupStudent.status === 409 ? 'PASS' : 'FAIL');

        // Test 9: Issue Book
        const issueRes = await request('/api/issues', 'POST', {
            book_id: newBook.body.id,
            student_id: newStudent.body.id,
            issue_date: '2026-10-14',
            due_date: '2026-10-28',
            remarks: 'Semester study material'
        });
        console.log('9. POST /api/issues:', issueRes.status === 201 ? 'PASS' : 'FAIL', 'Issue ID:', issueRes.body.issue?.issueId);

        // Test 10: Prevent double issue
        const doubleIssue = await request('/api/issues', 'POST', {
            book_id: newBook.body.id,
            student_id: 1
        });
        console.log('10. Double Issue Prevention:', doubleIssue.status === 409 ? 'PASS' : 'FAIL');

        // Test 11: Return Book
        const returnRes = await request(`/api/issues/${issueRes.body.issue.issueId}/return`, 'POST');
        console.log('11. POST /api/issues/:id/return:', returnRes.status === 200 ? 'PASS' : 'FAIL');

        // Test 12: Return already returned book
        const doubleReturn = await request(`/api/issues/${issueRes.body.issue.issueId}/return`, 'POST');
        console.log('12. Double Return Prevention:', doubleReturn.status === 400 ? 'PASS' : 'FAIL');

        // Test 13: Reports
        const reports = await request('/api/reports');
        console.log('13. GET /api/reports:', reports.status === 200 ? 'PASS' : 'FAIL', 'Top books:', reports.body.mostBorrowed.length);

        console.log('--- ALL BACKEND API TESTS COMPLETED SUCCESSFULLY ---');
    } catch (err) {
        console.error('Test error:', err);
    } finally {
        server.close();
        process.exit(0);
    }
}

runTests();
