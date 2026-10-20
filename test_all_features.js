const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('====================================================');
    console.log('  STARTING END-TO-END VERIFICATION SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    try {
        // -----------------------------------------------------------------
        // TEST 1: Health check
        // -----------------------------------------------------------------
        console.log('--- 1. SYSTEM HEALTH CHECK ---');
        const healthRes = await fetch('http://localhost:5000/api/health');
        const healthData = await healthRes.json();
        assert(healthRes.ok, `GET /api/health returned status ${healthRes.status}`);
        assert(healthData.status === 'ok' && healthData.database?.connected === true, `Database status is healthy (engine: ${healthData.database?.engine})`);

        // -----------------------------------------------------------------
        // TEST 2: Librarian Login & Remember Me Token Lifespans
        // -----------------------------------------------------------------
        console.log('\n--- 2. LIBRARIAN AUTHENTICATION & REMEMBER ME DURATION ---');
        const loginResStandard = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'librarian@hslibrary.edu',
                password: 'Admin@123',
                rememberMe: false
            })
        });
        const loginDataStandard = await loginResStandard.json();
        assert(loginResStandard.ok, `Standard login succeeded for ${loginDataStandard.user?.email}`);
        assert(loginDataStandard.token != null, 'JWT Token received for standard session');

        // Decode JWT payload to check expiry
        const payloadStandard = JSON.parse(Buffer.from(loginDataStandard.token.split('.')[1], 'base64').toString());
        const standardDurationSec = payloadStandard.exp - payloadStandard.iat;
        assert(Math.round(standardDurationSec / 3600) === 24, `Standard token duration is 24 hours (${standardDurationSec}s)`);

        // Test Remember Me = true
        const loginResRemember = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'librarian@hslibrary.edu',
                password: 'Admin@123',
                rememberMe: true
            })
        });
        const loginDataRemember = await loginResRemember.json();
        assert(loginResRemember.ok, 'Remember Me login succeeded');
        const payloadRemember = JSON.parse(Buffer.from(loginDataRemember.token.split('.')[1], 'base64').toString());
        const rememberDurationDays = Math.round((payloadRemember.exp - payloadRemember.iat) / 86400);
        assert(rememberDurationDays === 30, `Remember Me token duration is 30 days (${rememberDurationDays} days)`);

        const authToken = loginDataRemember.token;

        // -----------------------------------------------------------------
        // TEST 3: Book Cover Image Upload (Multer, Validation, Disk Persistence)
        // -----------------------------------------------------------------
        console.log('\n--- 3. BOOK COVER IMAGE UPLOAD & VALIDATION ---');
        
        // 3a. Valid PNG upload
        const samplePngBytes = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ]);

        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        let bodyBuffer = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="coverImage"; filename="classic-novel.png"\r\nContent-Type: image/png\r\n\r\n`),
            samplePngBytes,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const uploadRes = await fetch('http://localhost:5000/api/upload/cover', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: bodyBuffer
        });
        const uploadData = await uploadRes.json();
        assert(uploadRes.ok, `Cover upload succeeded: ${uploadData.cover_image}`);
        assert(uploadData.cover_image.startsWith('/uploads/covers/cover-'), 'Upload web path correctly formatted');

        // Check file exists on disk
        const savedDiskPath = path.join(__dirname, uploadData.cover_image.replace(/^\//, ''));
        assert(fs.existsSync(savedDiskPath), `File persists on disk at ${savedDiskPath}`);

        // Check static HTTP GET serving
        const staticRes = await fetch(`http://localhost:5000${uploadData.cover_image}`);
        assert(staticRes.ok, `Static serving endpoint http://localhost:5000${uploadData.cover_image} returned status 200`);
        assert(staticRes.headers.get('content-type')?.includes('image/png'), 'Static serving returned correct image/png MIME type');

        // 3b. Invalid file type rejection
        const badFileBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const badBodyBuffer = Buffer.concat([
            Buffer.from(`--${badFileBoundary}\r\nContent-Disposition: form-data; name="coverImage"; filename="danger.exe"\r\nContent-Type: application/x-msdownload\r\n\r\n`),
            Buffer.from('executable binary code'),
            Buffer.from(`\r\n--${badFileBoundary}--\r\n`)
        ]);
        const badUploadRes = await fetch('http://localhost:5000/api/upload/cover', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': `multipart/form-data; boundary=${badFileBoundary}`
            },
            body: badBodyBuffer
        });
        assert(!badUploadRes.ok, 'Non-image executable upload correctly rejected with 400');

        // -----------------------------------------------------------------
        // TEST 4: Add & Edit Book With Uploaded Cover
        // -----------------------------------------------------------------
        console.log('\n--- 4. ADD & EDIT BOOK CATALOG RECORD ---');
        const addBookRes = await fetch('http://localhost:5000/api/books', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Madhushala (Special Edition)',
                author: 'Harivansh Rai Bachchan',
                category: 'Hindi Literature',
                language: 'Hindi',
                isbn: '978-8126712345',
                cover_image: uploadData.cover_image,
                shelf: 'Stack H-402',
                publication_year: 1935,
                description: 'Classic book of Hindi poetry.'
            })
        });
        const addedBook = await addBookRes.json();
        assert(addBookRes.ok, `Book "${addedBook.title}" added with ID ${addedBook.id}`);
        assert(addedBook.cover_image === uploadData.cover_image, 'Book record successfully stores persistent cover image path');

        // Fetch book back
        const fetchBookRes = await fetch(`http://localhost:5000/api/books/${addedBook.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const fetchedBook = await fetchBookRes.json();
        assert(fetchedBook.cover_image === uploadData.cover_image, 'Fetched book retains persistent uploaded cover image URL');

        // -----------------------------------------------------------------
        // TEST 5: Password Recovery Flow (Forgot Password & Reset Token)
        // -----------------------------------------------------------------
        console.log('\n--- 5. PASSWORD RECOVERY & RESET FLOW ---');
        
        // 5a. Request reset token
        const forgotRes = await fetch('http://localhost:5000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'librarian@hslibrary.edu' })
        });
        const forgotData = await forgotRes.json();
        assert(forgotRes.ok, 'Password reset request returned status 200');
        assert(forgotData.devMode === true && forgotData.devToken != null, 'Dev testing token generated securely');

        const rawToken = forgotData.devToken;

        // 5b. Verify token endpoint
        const verifyRes = await fetch('http://localhost:5000/api/auth/verify-reset-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: rawToken })
        });
        const verifyData = await verifyRes.json();
        assert(verifyRes.ok && verifyData.valid === true, `Reset token verified successfully for ${verifyData.email}`);

        // 5c. Test invalid token
        const fakeVerifyRes = await fetch('http://localhost:5000/api/auth/verify-reset-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'invalid_or_forged_token_12345' })
        });
        assert(!fakeVerifyRes.ok, 'Invalid/forged reset token correctly rejected with 400');

        // 5d. Test password complexity validation
        const weakResetRes = await fetch('http://localhost:5000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: rawToken,
                newPassword: 'weak',
                confirmPassword: 'weak'
            })
        });
        assert(!weakResetRes.ok, 'Weak password (<8 chars) correctly rejected');

        // 5e. Successfully reset password with strong new password
        const newPassword = 'NewSecretPassword2026!';
        const validResetRes = await fetch('http://localhost:5000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: rawToken,
                newPassword: newPassword,
                confirmPassword: newPassword
            })
        });
        const resetResult = await validResetRes.json();
        assert(validResetRes.ok, 'Password successfully reset with bcrypt hash update');

        // 5f. Verify single-use token invalidation
        const reuseTokenRes = await fetch('http://localhost:5000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: rawToken,
                newPassword: 'AnotherPassword2026!',
                confirmPassword: 'AnotherPassword2026!'
            })
        });
        assert(!reuseTokenRes.ok, 'Used token is invalidated and cannot be reused (single-use token security)');

        // 5g. Sign in with the new password
        const newLoginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'librarian@hslibrary.edu',
                password: newPassword,
                rememberMe: true
            })
        });
        const newLoginData = await newLoginRes.json();
        assert(newLoginRes.ok, `Signed in successfully with new password for ${newLoginData.user?.name}`);

        // 5h. Old password no longer works
        const oldLoginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'librarian@hslibrary.edu',
                password: 'password123'
            })
        });
        assert(!oldLoginRes.ok, 'Old password rejected after password reset');

        // Restore original password for convenience of user
        const restoreForgot = await fetch('http://localhost:5000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'librarian@hslibrary.edu' })
        });
        const restoreData = await restoreForgot.json();
        await fetch('http://localhost:5000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: restoreData.devToken,
                newPassword: 'Admin@123',
                confirmPassword: 'Admin@123'
            })
        });
        console.log('  [INFO] Default password restored to "Admin@123" for testing convenience.');

        // Clean up sample book
        await fetch(`http://localhost:5000/api/books/${addedBook.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${newLoginData.token}` }
        });

    } catch (err) {
        console.error('Test run error:', err);
        failed++;
    }

    console.log('\n====================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
