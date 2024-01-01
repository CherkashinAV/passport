import {randomUUID} from 'crypto';
import {dbClient} from '../app/lib/db-client';

export async function clear_db() {
	await dbClient.query(`--sql
		SELECT empty_tables();`
	);
}

export async function insertInvitation(args: {
	name: string,
	surname: string,
	email: string,
	invitationCode: string,
	secretActive: boolean,
	partition?: string,
	publicId?: string
}) {
	await dbClient.query(`--sql
		INSERT INTO users
		(name, surname, email, secret_code, secret_active, partition, public_id)
		VALUES
		($1, $2, $3, $4, $5, $6, $7);
	`, [
		args.name,
		args.surname,
		args.email, 
		args.invitationCode, 
		args.secretActive,
		args.partition ?? 'global',
		args.publicId ?? randomUUID()
	]);
}

export async function registerUser(args: {
	name: string,
	surname: string,
	passwordHash: string,
	email: string,
	partition: string,
	publicId: string
}) {
	const query = `--sql
		INSERT INTO users (name, surname, email, password, partition, public_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`;

	try {
		await dbClient.query(query, [
			args.name,
			args.surname,
			args.email,
			args.passwordHash,
			args.partition,
			args.publicId
		]);
	} catch {
		return false;
	}

	return true;
}
