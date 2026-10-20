/**
 * =============================================================================
 * HS LIBRARY — CENTRALIZED ERROR HANDLING & CUSTOM ERROR CLASSES
 * TQM Q09: Reduce Bugs — Systematic Exception Handling & Response Uniformity
 * =============================================================================
 */

const crypto = require('crypto');
const logger = require('./logger');

/**
 * Base Application Error
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true; // Flag for expected/known operational errors
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Invalid request parameters.', code = 'BAD_REQUEST', details = null) {
        super(message, 400, code, details);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required to access this resource.', code = 'UNAUTHORIZED') {
        super(message, 401, code);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') {
        super(message, 403, code);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Requested resource not found.', code = 'NOT_FOUND') {
        super(message, 404, code);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict detected.', code = 'CONFLICT') {
        super(message, 409, code);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed for one or more fields.', details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class DatabaseConstraintError extends AppError {
    constructor(message = 'Database constraint violation detected.', details = null) {
        super(message, 409, 'DATABASE_CONSTRAINT_ERROR', details);
    }
}

class TokenExpiredError extends AppError {
    constructor(message = 'Session token has expired. Please re-authenticate.', code = 'TOKEN_EXPIRED') {
        super(message, 401, code);
    }
}

/**
 * Middleware: Attach unique request ID and timing to every request
 */
function requestIdMiddleware(req, res, next) {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    req.startTime = Date.now();
    next();
}

/**
 * Middleware: 404 Not Found handler for undefined API routes
 */
function notFoundHandler(req, res, next) {
    next(new NotFoundError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (err instanceof SyntaxError && err.status === 400 ? 400 : 500);
    const code = err.code || (statusCode === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR');
    const isProd = process.env.NODE_ENV === 'production';

    // Mask internal error details for unexpected 500s in production
    let userMessage = err.message;
    if (statusCode === 500 && !err.isOperational && isProd) {
        userMessage = 'An internal system error occurred. Diagnostic reference ID: ' + (req.id || 'N/A');
    }

    // Determine module context from request path
    let moduleContext = 'General';
    if (req.originalUrl.includes('/api/auth')) moduleContext = 'Authentication';
    else if (req.originalUrl.includes('/api/books')) moduleContext = 'Books Catalog';
    else if (req.originalUrl.includes('/api/students')) moduleContext = 'Student Management';
    else if (req.originalUrl.includes('/api/issues')) moduleContext = 'Circulation Desk';
    else if (req.originalUrl.includes('/api/bugs')) moduleContext = 'Bug Tracker';
    else if (req.originalUrl.includes('/api/upload')) moduleContext = 'File Upload';
    else if (req.originalUrl.includes('/api/stats') || req.originalUrl.includes('/api/reports')) moduleContext = 'Reports & Stats';

    // Record structured log
    logger.error(err.message, {
        error: err,
        module: moduleContext,
        statusCode,
        code,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        libraryId: req.user?.libraryId || null,
        userId: req.user?.id || null,
        ip: req.ip || req.connection?.remoteAddress
    });

    res.status(statusCode).json({
        success: false,
        error: userMessage,
        code,
        requestId: req.id,
        details: err.details || null
    });
}

/**
 * Global process safety handlers to prevent unhandled crashes
 */
function setupGlobalProcessErrorHandlers() {
    process.on('uncaughtException', (err) => {
        logger.error(`[UNCAUGHT EXCEPTION] ${err.message}`, { error: err });
    });

    process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        logger.error(`[UNHANDLED REJECTION] ${error.message}`, { error });
    });
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    DatabaseConstraintError,
    TokenExpiredError,
    requestIdMiddleware,
    notFoundHandler,
    errorHandler,
    setupGlobalProcessErrorHandlers
};
