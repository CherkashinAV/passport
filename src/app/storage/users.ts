import {convertUserFromDBEntry} from '../helpers';
import {dbClient} from '../lib/db-client';
import {User} from '../types';

interface CreateNewUserRecordArgs {
    name: string;
    surname: string;
    patronymic?: string;
    email: string;
    passwordHash: string;
    partition?: string;
}

export async function findUserByPublicId(publicId: string): Promise<User | null> {
    const {rows} = await dbClient.query(
        `--sql
		SELECT * FROM users WHERE public_id = $1;
	`,
        [publicId]
    );

    if (!rows || !rows.length) {
        return null;
    }

    return convertUserFromDBEntry(rows[0]);
}

export async function findUserByEmail(email: string, partition: string): Promise<User | null> {
    const {rows} = await dbClient.query(
        `--sql
		SELECT * FROM users
		WHERE email = $1 AND partition = $2;
	`,
        [email, partition]
    );

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
		INSERT INTO users (name, surname, patronymic, email, password, partition)
		VALUES ($1, $2, $3, $4, $5, $6)
	`;

    try {
        await dbClient.query(query, [args.name, args.surname, args.patronymic ?? '', args.email, args.passwordHash, args.partition]);
    } catch {
        return false;
    }

    return true;
}

export async function insertInvitation(args: {
    name: string;
    surname: string;
    patronymic?: string;
    email: string;
    partition: string;
    role: string;
}) {
    try {
        const {rows} = await dbClient.query<{secret_code: string, public_id: string}>(
            `--sql
			INSERT INTO users
			(name, surname, patronymic, email, secret_active, partition, role)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING secret_code, public_id;
		`,
            [args.name, args.surname, args.patronymic ?? '', args.email, true, args.partition, args.role]
        );

        return {secret: rows[0].secret_code, publicId: rows[0].public_id};
    } catch (err) {
        console.error(err);
        return null;
    }
}

export async function storeNewSecret(args: {userId: string; secret: string}) {
    const query = `--sql
		UPDATE users
		SET secret_code = $1, secret_active = true
		WHERE public_id = $2
	`;

    try {
        await dbClient.query(query, [args.secret, args.userId]);
    } catch {
        return false;
    }

    return true;
}

export async function updatePassword(args: {userId: string; passwordHash: string}) {
    const query = `--sql
		UPDATE users
		SET password = $1, secret_active = false
		WHERE public_id = $2
	`;

    try {
        await dbClient.query(query, [args.passwordHash, args.userId]);
    } catch {
        return false;
    }

    return true;
}

export async function findUsersByRole(role: string, partition: string, search?: string): Promise<string[]> {
    const {rows} = await dbClient.query<{public_id: string}>(
        `--sql
		SELECT public_id FROM users
		WHERE 
            role = $1 AND 
            partition = $2 AND 
            (
				CASE
					WHEN ${search ? `'${search}'` : null} IS NOT NULL THEN 
                        LOWER(CONCAT(name, ' ', surname, ' ', patronymic)) LIKE LOWER('%${search}%')
					ELSE TRUE
				END
			)
	`,
        [role, partition]
    );

    return rows.map((row) => row.public_id);
}
