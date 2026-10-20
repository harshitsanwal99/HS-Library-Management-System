/**
 * =============================================================================
 * HS LIBRARY — STRICT INPUT VALIDATION & SANITIZATION ENGINE
 * TQM Q09: Reduce Bugs — Preventive Input Verification & Error Defense
 * =============================================================================
 */

const { BadRequestError, ValidationError } = require('./errors');

// Standard Email Regex (RFC 5322 compliant simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Standard Phone Regex (supports international format, +, digits, dashes, spaces)
const PHONE_REGEX = /^[+]?[0-9\s\-()]{7,25}$/;

// Standard Student ID Regex (alphanumeric with hyphens, slashes, dots)
const STUDENT_ID_REGEX = /^[A-Za-z0-9._\-\/]{2,50}$/;

// Allowed Bug Modules and Severities for TQM Tracker
const VALID_BUG_MODULES = [
    'Books',
    'Students',
    'Issues/Returns',
    'Circulation',
    'Auth',
    'UI',
    'Reports',
    'Database',
    'Logging',
    'Other',
    'General',
    'Settings',
    'File Upload',
    'Authentication',
    'Books Catalog',
    'Circulation Desk',
    'Student Management'
];

const VALID_BUG_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const VALID_BUG_STATUSES = ['Open', 'In Progress', 'Resolved', 'Fixed', 'Closed'];

/**
 * Validate numeric database ID parameter
 */
function validateId(id, fieldName = 'ID') {
    if (id === undefined || id === null || id === '') {
        throw new ValidationError(`${fieldName} is required.`);
    }
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0 || !Number.isFinite(num)) {
        throw new ValidationError(`Invalid ${fieldName}: must be a positive integer.`);
    }
    return num;
}

/**
 * Validate and clean ISBN (supports ISBN-10 and ISBN-13 format)
 */
/**
 * Validate and clean ISBN (supports ISBN-10 and ISBN-13 format with checksum verification)
 */
function validateIsbnChecksum(isbn) {
    if (!isbn || typeof isbn !== 'string') return false;
    const clean = isbn.replace(/[\s\-]/g, '').toUpperCase();
    if (clean.length === 10) {
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            const digit = parseInt(clean[i], 10);
            if (isNaN(digit)) return false;
            sum += digit * (10 - i);
        }
        const lastChar = clean[9];
        const lastVal = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
        if (isNaN(lastVal)) return false;
        sum += lastVal;
        return sum % 11 === 0;
    } else if (clean.length === 13) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(clean[i], 10);
            if (isNaN(digit)) return false;
            sum += digit * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(clean[12], 10);
    }
    return false;
}

function validateIsbn(isbn) {
    if (!isbn || typeof isbn !== 'string') return null;
    const clean = isbn.replace(/[\s\-]/g, '').toUpperCase();
    if (!clean) return null;

    // Check ISBN-10 or ISBN-13 format
    const isIsbn10 = /^[0-9]{9}[0-9X]$/.test(clean);
    const isIsbn13 = /^[0-9]{13}$/.test(clean);

    if (!isIsbn10 && !isIsbn13) {
        throw new BadRequestError('Invalid ISBN format. Must be a valid 10 or 13-digit standard ISBN.');
    }

    return isbn.trim();
}

/**
 * Validate ISO date string (YYYY-MM-DD)
 */
function validateDateString(dateStr, fieldName = 'Date') {
    if (!dateStr || typeof dateStr !== 'string') {
        throw new BadRequestError(`${fieldName} is required and must be in YYYY-MM-DD format.`);
    }
    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new BadRequestError(`${fieldName} must follow the YYYY-MM-DD standard format.`);
    }
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
        throw new BadRequestError(`${fieldName} contains an invalid calendar date.`);
    }
    return trimmed;
}

/**
 * Validate Book Payload (for Creation and Update)
 */
function validateBookInput(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('Request body must be a valid JSON object.');
    }

    const {
        title,
        author,
        category,
        language,
        isbn,
        shelf,
        publication_year,
        cover_image,
        description
    } = data;

    const errors = [];

    // Title validation
    if (!isUpdate || title !== undefined) {
        if (!title || typeof title !== 'string' || !title.trim()) {
            errors.push({ field: 'title', message: 'Book title is required and cannot be empty or whitespace only.' });
        } else if (title.trim().length < 2) {
            errors.push({ field: 'title', message: 'Book title must be at least 2 characters long.' });
        } else if (title.trim().length > 255) {
            errors.push({ field: 'title', message: 'Book title cannot exceed 255 characters.' });
        }
    }

    // Author validation
    if (!isUpdate || author !== undefined) {
        if (!author || typeof author !== 'string' || !author.trim()) {
            errors.push({ field: 'author', message: 'Author name is required and cannot be empty.' });
        } else if (author.trim().length < 2) {
            errors.push({ field: 'author', message: 'Author name must be at least 2 characters long.' });
        } else if (author.trim().length > 255) {
            errors.push({ field: 'author', message: 'Author name cannot exceed 255 characters.' });
        }
    }

    // Category validation
    if (!isUpdate || category !== undefined) {
        if (!category || typeof category !== 'string' || !category.trim()) {
            errors.push({ field: 'category', message: 'Category is required and cannot be empty.' });
        } else if (category.trim().length < 2 || category.trim().length > 100) {
            errors.push({ field: 'category', message: 'Category must be between 2 and 100 characters.' });
        }
    }

    // Language validation
    let cleanLang = 'English';
    if (language !== undefined && language !== null) {
        if (typeof language !== 'string') {
            errors.push({ field: 'language', message: 'Language must be a text value (English or Hindi).' });
        } else {
            const langNorm = language.trim().toLowerCase();
            if (langNorm === 'hindi') {
                cleanLang = 'Hindi';
            } else if (langNorm === 'english') {
                cleanLang = 'English';
            } else if (langNorm) {
                cleanLang = language.trim();
            }
        }
    }

    // Publication Year validation
    let cleanYear = new Date().getFullYear();
    if (publication_year !== undefined && publication_year !== null && publication_year !== '') {
        const yearNum = Number(publication_year);
        const currentYear = new Date().getFullYear();
        if (!Number.isInteger(yearNum) || yearNum < 1000 || yearNum > currentYear + 1) {
            errors.push({
                field: 'publication_year',
                message: `Publication year must be an integer between 1000 and ${currentYear + 1}.`
            });
        } else {
            cleanYear = yearNum;
        }
    }

    // ISBN validation
    let cleanIsbn = null;
    if (isbn !== undefined && isbn !== null && isbn !== '') {
        try {
            cleanIsbn = validateIsbn(isbn);
        } catch (isbnErr) {
            errors.push({ field: 'isbn', message: isbnErr.message });
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Book input validation failed.', errors);
    }

    return {
        title: title ? title.trim() : undefined,
        author: author ? author.trim() : undefined,
        category: category ? category.trim() : undefined,
        language: cleanLang,
        isbn: cleanIsbn,
        shelf: shelf && typeof shelf === 'string' && shelf.trim() ? shelf.trim() : 'Main Stack A-1',
        publication_year: cleanYear,
        cover_image: cover_image && typeof cover_image === 'string' && cover_image.trim() ? cover_image.trim() : null,
        description: description && typeof description === 'string' && description.trim() ? description.trim() : null
    };
}

/**
 * Validate Student Payload (for Creation and Update)
 */

/**
 * Normalize phone number by removing redundant spaces and punctuation
 */
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const clean = phone.trim();
    if (!PHONE_REGEX.test(clean)) return null;
    const hasPlus = clean.startsWith('+');
    const digitsOnly = clean.replace(/[^0-9]/g, '');
    return hasPlus ? '+' + digitsOnly : digitsOnly;
}

function validateStudentInput(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('Request body must be a valid JSON object.');
    }

    const { student_id, name, email, department, phone } = data;
    const errors = [];

    // Student ID validation
    if (!isUpdate || student_id !== undefined) {
        if (!student_id || typeof student_id !== 'string' || !student_id.trim()) {
            errors.push({ field: 'student_id', message: 'Student ID (Roll Number) is required.' });
        } else {
            const cleanCode = student_id.trim();
            if (!STUDENT_ID_REGEX.test(cleanCode)) {
                errors.push({
                    field: 'student_id',
                    message: 'Student ID must be 2-50 alphanumeric characters (hyphens, dots, underscores allowed).'
                });
            }
        }
    }

    // Name validation
    if (!isUpdate || name !== undefined) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            errors.push({ field: 'name', message: 'Student name is required.' });
        } else if (name.trim().length < 2) {
            errors.push({ field: 'name', message: 'Student name must be at least 2 characters long.' });
        } else if (name.trim().length > 255) {
            errors.push({ field: 'name', message: 'Student name cannot exceed 255 characters.' });
        }
    }

    // Email validation
    let cleanEmail = null;
    if (email !== undefined && email !== null && email !== '') {
        if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
            errors.push({ field: 'email', message: 'Please provide a valid email address.' });
        } else {
            cleanEmail = email.trim().toLowerCase();
        }
    }

    // Phone validation
    let cleanPhone = null;
    if (phone !== undefined && phone !== null && phone !== '') {
        if (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
            errors.push({ field: 'phone', message: 'Phone number format is invalid (must be 7-25 digits/symbols).' });
        } else {
            cleanPhone = normalizePhoneNumber(phone) || phone.trim();
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Student input validation failed.', errors);
    }

    return {
        student_id: student_id ? student_id.trim().toUpperCase() : undefined,
        name: name ? name.trim() : undefined,
        email: cleanEmail,
        department: department && typeof department === 'string' && department.trim() ? department.trim() : 'General Studies',
        phone: cleanPhone
    };
}

/**
 * Validate Circulation Issue Payload
 */
function validateIssueInput(data) {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('Request body must be a valid JSON object.');
    }

    const { book_id, student_id, issue_date, due_date, remarks } = data;
    const errors = [];

    let cleanBookId = null;
    try {
        cleanBookId = validateId(book_id, 'Book ID');
    } catch (err) {
        errors.push({ field: 'book_id', message: err.message });
    }

    let cleanStudentId = null;
    try {
        cleanStudentId = validateId(student_id, 'Student ID');
    } catch (err) {
        errors.push({ field: 'student_id', message: err.message });
    }

    // Date validation
    const todayStr = new Date().toISOString().split('T')[0];
    let cleanIssueDate = todayStr;
    if (issue_date !== undefined && issue_date !== null && issue_date !== '') {
        try {
            cleanIssueDate = validateDateString(issue_date, 'Issue Date');
        } catch (err) {
            errors.push({ field: 'issue_date', message: err.message });
        }
    }

    let cleanDueDate = null;
    if (due_date !== undefined && due_date !== null && due_date !== '') {
        try {
            cleanDueDate = validateDateString(due_date, 'Due Date');
            if (cleanDueDate < cleanIssueDate) {
                errors.push({ field: 'due_date', message: 'Due date cannot be earlier than the issue checkout date.' });
            }
        } catch (err) {
            errors.push({ field: 'due_date', message: err.message });
        }
    } else {
        const targetDate = new Date(new Date(cleanIssueDate).getTime() + 14 * 86400000);
        cleanDueDate = targetDate.toISOString().split('T')[0];
    }

    if (errors.length > 0) {
        throw new ValidationError('Book issue validation failed.', errors);
    }

    return {
        book_id: cleanBookId,
        student_id: cleanStudentId,
        issue_date: cleanIssueDate,
        due_date: cleanDueDate,
        remarks: remarks && typeof remarks === 'string' && remarks.trim() ? remarks.trim().substring(0, 500) : null
    };
}

/**
 * Validate Bug Report Payload
 */
function validateBugInput(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        throw new BadRequestError('Request body must be a valid JSON object.');
    }

    const {
        title,
        description,
        module,
        severity,
        status,
        steps_to_reproduce,
        expected_result,
        actual_result,
        assigned_to,
        fix_details
    } = data;

    const errors = [];

    // Title
    if (!isUpdate || title !== undefined) {
        if (!title || typeof title !== 'string' || !title.trim()) {
            errors.push({ field: 'title', message: 'Bug title is required.' });
        } else if (title.trim().length < 3 || title.trim().length > 255) {
            errors.push({ field: 'title', message: 'Bug title must be between 3 and 255 characters.' });
        }
    }

    // Description (fallback to actual_behavior, actual_result, steps, or title if not explicitly provided)
    const rawDesc = (description && typeof description === 'string' && description.trim())
        ? description.trim()
        : (data.actual_behavior || data.actual_result || data.steps_to_reproduce || title || '').toString().trim();

    if (!isUpdate || description !== undefined) {
        if (!rawDesc) {
            errors.push({ field: 'description', message: 'Bug description is required.' });
        } else if (rawDesc.length < 5) {
            errors.push({ field: 'description', message: 'Bug description must be at least 5 characters long.' });
        }
    }

    // Module (case-insensitive normalization)
    let cleanModule = 'General';
    if (!isUpdate || module !== undefined) {
        if (!module || typeof module !== 'string' || !module.trim()) {
            errors.push({ field: 'module', message: 'Affected module is required.' });
        } else {
            const rawMod = module.trim();
            const matchedMod = VALID_BUG_MODULES.find(m => m.toLowerCase() === rawMod.toLowerCase());
            if (!matchedMod) {
                errors.push({
                    field: 'module',
                    message: `Module must be one of: ${VALID_BUG_MODULES.join(', ')}.`
                });
            } else {
                cleanModule = matchedMod;
            }
        }
    }

    // Severity (case-insensitive normalization)
    let cleanSeverity = 'Medium';
    if (severity !== undefined && severity !== null) {
        const rawSev = typeof severity === 'string' ? severity.trim() : '';
        const matchedSev = VALID_BUG_SEVERITIES.find(s => s.toLowerCase() === rawSev.toLowerCase());
        if (!matchedSev) {
            errors.push({
                field: 'severity',
                message: `Severity must be one of: ${VALID_BUG_SEVERITIES.join(', ')}.`
            });
        } else {
            cleanSeverity = matchedSev;
        }
    }

    // Status (case-insensitive normalization)
    let cleanStatus = 'Open';
    if (status !== undefined && status !== null) {
        const rawStat = typeof status === 'string' ? status.trim().replace(/_/g, ' ') : '';
        const matchedStat = VALID_BUG_STATUSES.find(s => s.toLowerCase() === rawStat.toLowerCase());
        if (!matchedStat) {
            errors.push({
                field: 'status',
                message: `Status must be one of: ${VALID_BUG_STATUSES.join(', ')}.`
            });
        } else {
            cleanStatus = matchedStat;
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Bug report validation failed.', errors);
    }

    const effectiveExpected = expected_result || data.expected_behavior || null;
    const effectiveActual = actual_result || data.actual_behavior || null;

    return {
        title: title ? title.trim() : undefined,
        description: rawDesc ? rawDesc : undefined,
        module: cleanModule,
        severity: cleanSeverity,
        status: cleanStatus,
        steps_to_reproduce: steps_to_reproduce && typeof steps_to_reproduce === 'string' ? steps_to_reproduce.trim() : null,
        expected_result: effectiveExpected && typeof effectiveExpected === 'string' ? effectiveExpected.trim() : null,
        actual_result: effectiveActual && typeof effectiveActual === 'string' ? effectiveActual.trim() : null,
        assigned_to: assigned_to && typeof assigned_to === 'string' ? assigned_to.trim() : null,
        fix_details: fix_details && typeof fix_details === 'string' ? fix_details.trim() : null
    };
}


/**
 * Calculate overdue days and late fine for circulation loans
 */
function calculateOverdueFine(dueDate, returnDate = new Date(), dailyRate = 5, gracePeriodDays = 0) {
    if (!dueDate) return { isOverdue: false, overdueDays: 0, fineAmount: 0 };
    const due = new Date(dueDate);
    const returned = new Date(returnDate);
    if (isNaN(due.getTime()) || isNaN(returned.getTime())) {
        return { isOverdue: false, overdueDays: 0, fineAmount: 0 };
    }
    const diffTime = returned.setHours(0,0,0,0) - due.setHours(0,0,0,0);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= gracePeriodDays) {
        return { isOverdue: false, overdueDays: 0, fineAmount: 0 };
    }
    const chargeableDays = diffDays - gracePeriodDays;
    return {
        isOverdue: true,
        overdueDays: diffDays,
        fineAmount: Math.max(0, chargeableDays * dailyRate)
    };
}

module.exports = {
    validateId,
    validateIsbn,
    validateIsbnChecksum,
    validateDateString,
    validateBookInput,
    validateStudentInput,
    validateIssueInput,
    validateBugInput,
    calculateOverdueFine,
    normalizePhoneNumber,
    VALID_BUG_MODULES,
    VALID_BUG_SEVERITIES,
    VALID_BUG_STATUSES
};
