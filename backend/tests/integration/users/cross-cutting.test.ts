import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { insertHierarchy } from '../../helpers/db.js';
import { expectNoSensitiveData } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { cookieFor } from '../../helpers/tokens.js';

describe('Users: requisitos transversais', () => {
  const ctx = useIntegrationContext();

  it('[USER-32] nenhuma resposta de sucesso de /users/* expõe senha, hash ou flags internas', async () => {
    const h = await insertHierarchy(ctx.pool);

    const team = await request(ctx.app).get('/api/v1/users/team').set('Cookie', cookieFor(h.G));
    const detail = await request(ctx.app).get(`/api/v1/users/${h.C1.id}`).set('Cookie', cookieFor(h.G));
    const profile = await request(ctx.app)
      .patch('/api/v1/users/me')
      .set('Cookie', cookieFor(h.C1))
      .send({ jobTitle: 'Desenvolvedor Pleno' });

    expect(team.status).toBe(200);
    expect(team.body.users.length).toBeGreaterThan(0);
    expect(detail.status).toBe(200);
    expect(profile.status).toBe(200);

    expectNoSensitiveData(team.body, 'GET /users/team');
    expectNoSensitiveData(detail.body, 'GET /users/:id');
    expectNoSensitiveData(profile.body, 'PATCH /users/me');
  });
});
