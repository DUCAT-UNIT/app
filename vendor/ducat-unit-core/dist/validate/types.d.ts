export interface ValidationError {
    path: string;
    code: string;
    message: string;
    context?: ValidationErrorContext;
}
export interface ValidationErrorContext {
    expected?: string;
    received?: string;
    validator?: string;
}
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
}
