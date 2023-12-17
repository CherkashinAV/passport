export interface User {
	id: number,
	publicId: string,
	role: string,
	name: string,
	surname: string,
	email: string,
	password?: string,
	secretCode: string,
	secretActive: boolean,
	createdAt: Date,
	updatedAt: Date,
	partition: string
};