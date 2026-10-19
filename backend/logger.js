/**
 * =============================================================================
 * HS LIBRARY — STRUCTURED LOGGING & ERROR DIAGNOSTICS MODULE
 * TQM Q09: Reduce Bugs — Diagnostic Traceability & Error Observability
 * =============================================================================
 * Features:
 * - Structured JSON / Formatted Log Output with ISO timestamps
 * - Log Levels: ERROR, WARN, INFO, DEBUG
 * - Request correlation ID tracking (requestId)
 * - Automatic redaction of sensitive credentials, passwords, tokens, hashes
 * - File rotation / size-capping (max 5 MB per log file, maintains backups)
 * - Safe fail-open file I/O (never crashes the server if write fails)
 * - In-memory ring buffer for live Quality Dashboard error review
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

// Determine log directory from environment or default to project logs/
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUP_FILES = 3;
const RECENT_BUFFER_SIZE = 100; // Keep last 100 error entries for QA dashboard

// Ensure log directory exists
try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
} catch (err) {
    console.error('[Logger Init Error] Failed to create log directory:', err.message);
}

const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');
const COMBINED_LOG_PATH = path.join(LOG_DIR, 'combined.log');

// In-memory ring buffer for authorized librarian Quality Dashboard inspection
const recentErrorsBuffer = [];

// Sensitive keys to redact automatically
const SENSITIVE_KEYS = new Set([
    'password',
    'password_hash',
    'confirm_password',
    'newpassword',
    'confirmpassword',
    'token',
    'devtoken',
    'authorization',
    'jwt',
    'secret',
    'reset_token_hash',
    'cookie',
    'db_password'
]);

/**
 * Deep-clean object to remove credentials and sensitive personal data
 */
function redactSensitiveData(obj, depth = 0) {
    if (!obj || depth > 5) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => redactSensitiveData(item, depth + 1));
    }

    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
            clean[key] = '[REDACTED]';
        } else if (typeof val === 'object' && val !== null) {
            clean[key] = redactSensitiveData(val, depth + 1);
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

/**
 * Safely rotate log file if size exceeds maximum allowed threshold
 */
function rotateLogFileIfNeeded(filePath) {
    try {
        if (!fs.existsSync(filePath)) return;
        const stats = fs.statSync(filePath);
        if (stats.size >= MAX_LOG_SIZE_BYTES) {
            for (let i = MAX_BACKUP_FILES - 1; i >= 1; i--) {
                const oldFile = `${filePath}.${i}`;
                const nextFile = `${filePath}.${i + 1}`;
                if (fs.existsSync(oldFile)) {
                    fs.renameSync(oldFile, nextFile);
                }
            }
            fs.renameSync(filePath, `${filePath}.1`);
        }
    } catch (err) {
        // Logging failure must never crash the service
        console.warn('[Logger] Rotation warning:', err.message);
    }
}

/**
 * Write log entry to disk asynchronously with fail-safe error trapping
 */
function appendToFile(filePath, logLine) {
    try {
        rotateLogFileIfNeeded(filePath);
        fs.appendFile(filePath, logLine + '\n', 'utf8', (err) => {
            if (err) {
                console.error('[Logger File Append Error]', err.message);
            }
        });
    } catch (err) {
        console.error('[Logger Append Exception]', err.message);
    }
}

/**
 * Core logging method
 */
function log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedContext = redactSensitiveData(context);

    const logEntry = {
        timestamp,
        level,
        message: typeof message === 'string' ? message : (message?.message || String(message)),
        ...sanitizedContext
    };

    // If an error object was passed, record stack in development/error log
    if (context.error instanceof Error) {
        logEntry.stack = context.error.stack;
        if (!logEntry.message && context.error.message) {
            logEntry.message = context.error.message;
        }
    }

    const jsonString = JSON.stringify(logEntry);

    // 1. Console stream with color-coded tags
    const colorTag = {
        ERROR: '\x1b[31m[ERROR]\x1b[0m',
        WARN:  '\x1b[33m[WARN] \x1b[0m',
        INFO:  '\x1b[36m[INFO] \x1b[0m',
        DEBUG: '\x1b[90m[DEBUG]\x1b[0m'
    }[level] || `[${level}]`;

    const reqTag = logEntry.requestId ? ` (${logEntry.requestId})` : '';
    const moduleTag = logEntry.module ? ` [${logEntry.module}]` : '';

    if (level === 'ERROR') {
        console.error(`${colorTag} ${timestamp}${reqTag}${moduleTag} ${logEntry.message}`);
        if (logEntry.stack && process.env.NODE_ENV !== 'production') {
            console.error(logEntry.stack);
        }
    } else if (level === 'WARN') {
        console.warn(`${colorTag} ${timestamp}${reqTag}${moduleTag} ${logEntry.message}`);
    } else {
        console.log(`${colorTag} ${timestamp}${reqTag}${moduleTag} ${logEntry.message}`);
    }

    // 2. Append to combined log
    appendToFile(COMBINED_LOG_PATH, jsonString);

    // 3. Append to dedicated error log and in-memory ring buffer if ERROR or WARN
    if (level === 'ERROR' || level === 'WARN') {
        appendToFile(ERROR_LOG_PATH, jsonString);

        // Add to ring buffer (strip verbose stacks for lightweight frontend rendering)
        const uiEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: logEntry.timestamp,
            level: logEntry.level,
            message: logEntry.message,
            module: logEntry.module || 'General',
            method: logEntry.method || null,
            url: logEntry.url || null,
            statusCode: logEntry.statusCode || null,
            requestId: logEntry.requestId || null
        };
        recentErrorsBuffer.unshift(uiEntry);
        if (recentErrorsBuffer.length > RECENT_BUFFER_SIZE) {
            recentErrorsBuffer.pop();
        }
    }
}

/**
 * Convenient wrapper methods
 */
const logger = {
    error: (msg, context = {}) => log('ERROR', msg, context),
    warn:  (msg, context = {}) => log('WARN', msg, context),
    info:  (msg, context = {}) => log('INFO', msg, context),
    debug: (msg, context = {}) => log('DEBUG', msg, context),

    /**
     * Retrieve recent redacted error logs for the Quality Dashboard
     */
    getRecentErrors: (limit = 25) => {
        return recentErrorsBuffer.slice(0, Math.min(limit, RECENT_BUFFER_SIZE));
    },

    /**
     * Clear buffer (used during testing or admin cleanup)
     */
    clearBuffer: () => {
        recentErrorsBuffer.length = 0;
    },

    /**
     * Log file locations and rotation status
     */
    getLogPaths: () => ({
        errorLog: ERROR_LOG_PATH,
        combinedLog: COMBINED_LOG_PATH,
        directory: LOG_DIR
    }),

    getLogFileStatus: () => {
        let errorLogSize = 0;
        let combinedLogSize = 0;
        try {
            if (fs.existsSync(ERROR_LOG_PATH)) errorLogSize = fs.statSync(ERROR_LOG_PATH).size;
            if (fs.existsSync(COMBINED_LOG_PATH)) combinedLogSize = fs.statSync(COMBINED_LOG_PATH).size;
        } catch (e) {}

        return {
            directory: LOG_DIR,
            errorLog: ERROR_LOG_PATH,
            combinedLog: COMBINED_LOG_PATH,
            errorLogSizeBytes: errorLogSize,
            combinedLogSizeBytes: combinedLogSize,
            rotationLimitBytes: MAX_LOG_SIZE_BYTES,
            maxBackups: MAX_BACKUP_FILES
        };
    }
};

module.exports = logger;
