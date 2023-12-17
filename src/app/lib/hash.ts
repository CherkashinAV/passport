import * as bcrypt from 'bcrypt';
import {config} from '../config';

class HashManager {
	private _saltRounds: number;

	constructor(saltRounds: number) {
		this._saltRounds = saltRounds;
	}

	async encode(data: string) {
		const salt = await bcrypt.genSalt(this._saltRounds);
		return bcrypt.hash(data, salt);
	}

	async validate(hash: string, data: string) {
		return bcrypt.compare(data, hash);
	}
}

export const hashManager = new HashManager(config['hash.saltRounds']);

