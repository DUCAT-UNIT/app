export function format_zod_errors(error) {
    return error.issues.map(issue => format_zod_issue(issue));
}
export function format_zod_issue(issue) {
    const path = issue.path.join('.');
    const context = {};
    if ('expected' in issue) {
        context.expected = String(issue.expected);
    }
    if ('received' in issue) {
        context.received = String(issue.received);
    }
    return {
        path: path || '(root)',
        code: issue.code,
        message: issue.message,
        context
    };
}
export function format_zod_error(error, validator_name) {
    const errors = format_zod_errors(error);
    const prefix = validator_name ? `${validator_name} failed: ` : '';
    const details = errors.map(e => format_validation_error(e)).join('; ');
    return `${prefix}${details}`;
}
export function format_validation_error(error) {
    const { path, message, context } = error;
    const parts = [path];
    if (context?.expected && context?.received) {
        parts.push(`(expected ${context.expected}, got ${context.received})`);
    }
    else {
        parts.push(`(${message})`);
    }
    return parts.join(' ');
}
export function create_validation_error(validator_name, details) {
    return `${validator_name}: ${details}`;
}
