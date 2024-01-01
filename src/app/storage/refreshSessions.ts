import {config} from '../config';
import {convertRefreshSessionFromDBEntry} from '../helpers';
import {dbClient} from '../lib/db-client';
import {RefreshSession} from '../types';

export async function getUserRefreshSessions(userUid: string): Promise<RefreshSession[] | null> {
	const {rows} = await dbClient.query(`--sql
		SELECT * FROM refresh_sessions WHERE user_id = $1;
	`, [userUid]);

	if (!rows || !rows.length) {
		return null;
	}

	return rows.map((row) => convertRefreshSessionFromDBEntry(row));
}

export async function createNewRefreshSession(args: {
	userId: string,
	userAgent?: string,
	fingerprint: string,
	refreshToken: string
}) {
	const expiresIn = Date.now() + config['refreshSessions.Ttl'];
	const query = `--sql
		INSERT INTO refresh_sessions
		(user_id, user_agent, fingerprint, expires_in, refresh_token)
		VALUES ($1, $2, $3, $4, $5)
	`;
	try {
		await dbClient.query(query, [args.userId, args.userAgent, args.fingerprint, expiresIn, args.refreshToken]);
	} catch {
		return false;
	}

	return true;
}

export async function deleteSession(args: {
	userId: string,
	fingerprint: string
}) {
	const query = `--sql
		DELETE FROM refresh_sessions
		WHERE user_id = $1 AND fingerprint = $2
	`;

	await dbClient.query(query, [args.userId, args.fingerprint]);
}