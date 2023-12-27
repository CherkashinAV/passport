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
	partition?: string
}) {
	await dbClient.query(`--sql
		INSERT INTO users
		(name, surname, email, secret_code, secret_active, partition)
		VALUES
		($1, $2, $3, $4, $5, $6);
	`, [
		args.name,
		args.surname,
		args.email, 
		args.invitationCode, 
		args.secretActive,
		args.partition ?? 'global'
	]);
}