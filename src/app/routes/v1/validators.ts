import z, {ZodError} from 'zod';

export const passwordValidator = z.string().min(6, {message: 'Password must be at least 6 symbols'});

export const nameValidator = z.string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string'
});

export const surnameValidator = z.string({
    required_error: 'Surname is required',
    invalid_type_error: 'Surname must be a string'
});

export function formatZodError(error: ZodError): string {
    return error.issues
        .map((issue) => {
            return `${issue.path.join('/')}:${issue.message}`;
        })
        .join(' ');
}
