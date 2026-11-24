import { describe, expect, it } from 'vitest';
import type { EvaluationAccess, EvaluationDTO, EvaluationRecord } from './evaluations.types.js';
import { toEvaluationDTO } from './evaluations.visibility.js';

const CREATED = new Date('2026-11-01T12:00:00.000Z');
const UPDATED = new Date('2026-11-20T12:00:00.000Z');
const SELF_AT = new Date('2026-11-10T09:00:00.000Z');
const MANAGER_AT = new Date('2026-11-15T18:00:00.000Z');

/** Registro com as DUAS partes preenchidas; cada cenário só varia o que foi enviado. */
function record(selfSubmitted: boolean, managerSubmitted: boolean): EvaluationRecord {
  return {
    id: 7,
    userId: 2,
    managerId: 1,
    cycle: '2026-S2',
    status: selfSubmitted && managerSubmitted ? 'CONCLUIDA' : 'ABERTA',
    selfScore: 4,
    selfComments: 'Entreguei a API de usuários.',
    selfSubmittedAt: selfSubmitted ? SELF_AT : null,
    managerScore: 3,
    managerFeedback: 'Bom ritmo; aprofunde testes.',
    managerSubmittedAt: managerSubmitted ? MANAGER_AT : null,
    createdAt: CREATED,
    updatedAt: UPDATED,
  };
}

/** DTO completo, sem ocultação: o esperado é derivado dele zerando só o que a §2.5 manda. */
function fullDTO(selfSubmitted: boolean, managerSubmitted: boolean): EvaluationDTO {
  return {
    id: 7,
    userId: 2,
    managerId: 1,
    cycle: '2026-S2',
    status: selfSubmitted && managerSubmitted ? 'CONCLUIDA' : 'ABERTA',
    selfScore: 4,
    selfComments: 'Entreguei a API de usuários.',
    selfSubmittedAt: selfSubmitted ? '2026-11-10T09:00:00.000Z' : null,
    managerScore: 3,
    managerFeedback: 'Bom ritmo; aprofunde testes.',
    managerSubmittedAt: managerSubmitted ? '2026-11-15T18:00:00.000Z' : null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
  };
}

const HIDE_SELF = { selfScore: null, selfComments: null };
const HIDE_MANAGER = { managerScore: null, managerFeedback: null };

/** Spec 04 §2.5: [acesso, self enviada?, gestor enviado?, campos ocultos]. */
const MATRIX: ReadonlyArray<
  readonly [Exclude<EvaluationAccess, 'NONE'>, boolean, boolean, Partial<EvaluationDTO>, string]
> = [
  ['EVALUATEE', false, false, HIDE_MANAGER, 'ABERTA, nada enviado: parte do gestor oculta'],
  ['EVALUATEE', true, false, HIDE_MANAGER, 'ABERTA, self enviada: parte do gestor oculta'],
  ['EVALUATEE', false, true, HIDE_MANAGER, 'ABERTA, gestor já enviou: parte do gestor CONTINUA oculta'],
  ['EVALUATEE', true, true, {}, 'CONCLUIDA: tudo revelado'],
  ['EVALUATOR', false, false, HIDE_SELF, 'self em rascunho: oculta para o gestor'],
  ['EVALUATOR', false, true, HIDE_SELF, 'gestor enviou, self em rascunho: self oculta'],
  ['EVALUATOR', true, false, {}, 'self enviada: visível para o gestor (Q-03)'],
  ['EVALUATOR', true, true, {}, 'CONCLUIDA: tudo visível'],
];

describe('toEvaluationDTO: visibilidade anti-viés (spec 04 §2.5)', () => {
  it.each(MATRIX)('[EVAL-24] %s, self=%s, gestor=%s → %o (%s)', (access, selfSubmitted, managerSubmitted, hidden) => {
    expect(toEvaluationDTO(record(selfSubmitted, managerSubmitted), access)).toEqual({
      ...fullDTO(selfSubmitted, managerSubmitted),
      ...hidden,
    });
  });

  it('[EVAL-24] status e datas de envio NUNCA são ocultados (o avaliado sabe SE o gestor enviou)', () => {
    const dto = toEvaluationDTO(record(false, true), 'EVALUATEE');

    expect(dto.status).toBe('ABERTA');
    expect(dto.managerSubmittedAt).toBe('2026-11-15T18:00:00.000Z');
    expect(dto.managerScore).toBeNull();
  });

  it('[EVAL-24] o formato do DTO é o mesmo em todos os cenários (mesmas chaves, ocultas como null)', () => {
    const keys = MATRIX.map(([access, selfSubmitted, managerSubmitted]) =>
      Object.keys(toEvaluationDTO(record(selfSubmitted, managerSubmitted), access)).sort(),
    );

    for (const keySet of keys) expect(keySet).toEqual(Object.keys(fullDTO(true, true)).sort());
  });

  it('[EVAL-24] não muta o registro recebido (função pura)', () => {
    const input = record(false, true);
    const snapshot = structuredClone(input);

    toEvaluationDTO(input, 'EVALUATEE');

    expect(input).toEqual(snapshot);
  });
});
