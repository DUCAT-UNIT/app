export class DucatError extends Error {
    constructor(message, code = 'DUCAT_ERROR', options) {
        super(message, options);
        this.name = 'DucatError';
        this.code = code;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export class WebSocketError extends DucatError {
    constructor(message, options) {
        super(message, 'WEBSOCKET_ERROR', options);
        this.name = 'WebSocketError';
    }
}
export class VaultError extends DucatError {
    constructor(message, options) {
        super(message, 'VAULT_ERROR', options);
        this.name = 'VaultError';
    }
}
export class ValidationError extends DucatError {
    constructor(message, options) {
        super(message, 'VALIDATION_ERROR', options);
        this.name = 'ValidationError';
        this.zod_error = options?.zod_error;
        this.details = this.zod_error
            ? this.zod_error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
            : [message];
    }
}
export class GuardianError extends DucatError {
    constructor(message, options) {
        super(message, 'GUARDIAN_ERROR', options);
        this.name = 'GuardianError';
    }
}
