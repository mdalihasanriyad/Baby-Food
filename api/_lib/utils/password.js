import bcrypt from 'bcryptjs';

const COST = 12;
export const hashPassword = (plain) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Compared against when the account does not exist, so response time does not reveal which accounts exist.
let dummy;
export const dummyHash = () => (dummy ??= bcrypt.hash('not-a-real-password', COST));
