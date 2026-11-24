import type { Request, RequestHandler, Response } from 'express';
import { viewerOf } from '../../shared/http/viewer-of.js';
import type { UpdateProfileInput, UserIdParam } from './users.schemas.js';
import type { UsersService } from './users.service.js';

/** Camada HTTP apenas: lê a requisição, delega ao service e monta a resposta. */
export function createUsersController(deps: { usersService: UsersService }) {
  const { usersService } = deps;

  const team: RequestHandler = async (req, res) => {
    const users = await usersService.listTeam(viewerOf(req).id);
    res.status(200).json({ users });
  };

  const getById = async ({ id }: UserIdParam, req: Request, res: Response): Promise<void> => {
    const user = await usersService.getVisibleUser(viewerOf(req), id);
    res.status(200).json({ user });
  };

  const updateMe: RequestHandler<Record<string, string>, unknown, UpdateProfileInput> = async (req, res) => {
    const user = await usersService.updateProfile(viewerOf(req).id, req.body);
    res.status(200).json({ user });
  };

  return { team, getById, updateMe };
}
