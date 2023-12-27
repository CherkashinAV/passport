import {convertUserFromDBEntry} from '../helpers';
import {dbClient} from '../lib/db-client';
import {User} from '../types';

interface CreateNewUserRecordArgs {
	name: string;
	surname: string;
	email: string;
	passwordHash: string;
	partition?: string;
}

export async function findUserByPublicId(publicId: string): Promise<User | null> {
	const {rows} = await dbClient.query(`--sql
		SELECT * FROM users WHERE public_id = $1;
	`, [publicId]);

	if (!rows || !rows.length) {
		return null;
	}

	return convertUserFromDBEntry(rows[0]);
}

export async function findUserByEmail(email: string, partition: string): Promise<User | null> {
	const {rows} = await dbClient.query(`--sql
		SELECT * FROM users
		WHERE email = $1 AND partition = $2;
	`, [email, partition]);

	if (!rows || !rows.length) {
		return null;
	}

	return convertUserFromDBEntry(rows[0]);
}

export async function updateUserWithInvitation(passwordHash: string, id: number) {
	const query = `--sql
		UPDATE users
		SET password = $1, secret_active = false
		WHERE id = $2;
	`;

	try {
		await dbClient.query(query, [passwordHash, id]);
	} catch {
		return false;
	}

	return true;
}

export async function createNewUserRecord(args: CreateNewUserRecordArgs) {
	const query = `--sql
		INSERT INTO users (name, surname, email, password, partition)
		VALUES ($1, $2, $3, $4, $5)
	`;

	try {
		await dbClient.query(query, [args.name, args.surname, args.email, args.passwordHash, args.partition]);
	} catch {
		return false;
	}

	return true;
}