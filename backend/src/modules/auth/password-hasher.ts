import bcrypt from 'bcrypt';
import type { PasswordHasher } from './auth.service.js';

export function createBcryptPasswordHasher(rounds: number): PasswordHasher {
  return {
    hash: (plain) => bcrypt.hash(plain, rounds),
    compare: (plain, hash) => bcrypt.compare(plain, hash),
  };
}
