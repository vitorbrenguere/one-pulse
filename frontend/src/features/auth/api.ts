import { apiRequest } from '../../services/http';
import type { UserDTO } from '../../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export const authApi = {
  me: () => apiRequest<{ user: UserDTO }>('/auth/me'),
  login: (input: LoginInput) => apiRequest<{ user: UserDTO }>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) => apiRequest<{ user: UserDTO }>('/auth/register', { method: 'POST', body: input }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
};
