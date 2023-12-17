import {User} from '../types';

export function convertUserFromDBEntry(row: any): User {
	return {
		...row,
		publicId: row.public_id,
		secretCode: row.secret_code,
		secretActive: row.secret_active,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}
}