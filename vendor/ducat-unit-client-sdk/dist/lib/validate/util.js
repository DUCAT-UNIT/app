export function format_zod_errors(zod_error) {
    return zod_error.issues.map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `${path}: ${issue.message}`;
    });
}
export function format_validation_message(zod_error, error_prefix) {
    const details = format_zod_errors(zod_error);
    const prefix = error_prefix ?? 'validation failed';
    return `${prefix}: ${details.join(', ')}`;
}
