import {RefreshSession, User} from '../types';

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

export function convertRefreshSessionFromDBEntry(row: any): RefreshSession {
	return {
		id: row.id,
		userId: row.user_id,
		refreshToken: row.refreshToken,
		userAgent: row.user_agent,
		fingerprint: row.fingerprint,
		expiresIn: row.expires_in,
		createdAt: row.created_at
	}
}