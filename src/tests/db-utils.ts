import {dbClient} from '../app/lib/db-client';

export async function clear_db() {
	await dbClient.query(`--sql
		SELECT empty_tables();`
	);
}