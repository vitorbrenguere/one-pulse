import { describe, expect, it } from 'vitest';
import { applyEvaluationChanges } from './evaluations.rules.js';
import type { EvaluationChanges, EvaluationPart, EvaluationState } from './evaluations.types.js';

const NOW = new Date('2026-11-24T15:30:00.000Z');
const EARLIER = new Date('2026-11-20T10:00:00.000Z');

const MISSING_SCORE = 'Informe a nota antes de enviar.';
const MISSING_FEEDBACK = 'Informe o feedback antes de enviar.';

/** Avaliação recém-aberta (EVR-01). */
const OPEN: EvaluationState = {
  status: 'ABERTA',
  selfScore: null,
  selfComments: null,
  selfSubmittedAt: null,
  managerScore: null,
  managerFeedback: null,
  managerSubmittedAt: null,
};

const state = (overrides: Partial<EvaluationState>): EvaluationState => ({ ...OPEN, ...overrides });

const SELF_DRAFT = state({ selfScore: 4, selfComments: 'Rascunho' });
const MANAGER_DRAFT = state({ managerScore: 3, managerFeedback: 'Parecer' });
const SELF_SUBMITTED = state({ selfScore: 4, selfComments: 'Enviada', selfSubmittedAt: EARLIER });
const MANAGER_SUBMITTED = state({ managerScore: 3, managerFeedback: 'Enviado', managerSubmittedAt: EARLIER });
const CONCLUDED = state({
  status: 'CONCLUIDA',
  selfScore: 4,
  selfComments: 'Enviada',
  selfSubmittedAt: EARLIER,
  managerScore: 3,
  managerFeedback: 'Enviado',
  managerSubmittedAt: EARLIER,
});

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('applyEvaluationChanges: rascunho e envio (spec 04 §2.4)', () => {
  it.each<readonly [string, EvaluationState, EvaluationPart, EvaluationChanges, EvaluationState]>([
    // EVR-02: rascunho
    ['EVR-02: avaliado salva rascunho', OPEN, 'SELF', { selfScore: 4, selfComments: 'Rascunho' }, SELF_DRAFT],
    ['EVR-02: null limpa o comentário e preserva a nota', SELF_DRAFT, 'SELF', { selfComments: null }, state({ selfScore: 4 })],
    ['EVR-02: null limpa a nota e preserva o comentário', SELF_DRAFT, 'SELF', { selfScore: null }, state({ selfComments: 'Rascunho' })],
    ['EVR-02: gestor salva rascunho', OPEN, 'MANAGER', { managerScore: 3, managerFeedback: 'Parecer' }, MANAGER_DRAFT],
    ['EVR-02: rascunho do gestor não toca a parte self', SELF_DRAFT, 'MANAGER', { managerScore: 2 }, state({ selfScore: 4, selfComments: 'Rascunho', managerScore: 2 })],
    ['EVR-02: rascunho do gestor com a self já enviada não muda o status', SELF_SUBMITTED, 'MANAGER', { managerFeedback: 'Parecer' }, { ...SELF_SUBMITTED, managerFeedback: 'Parecer' }],
    // EVR-03/04: envio de uma parte
    ['EVR-04: avaliado envia o rascunho salvo', SELF_DRAFT, 'SELF', { submit: true }, { ...SELF_DRAFT, selfSubmittedAt: NOW }],
    ['EVR-04: avaliado preenche e envia no mesmo payload', OPEN, 'SELF', { selfScore: 5, submit: true }, state({ selfScore: 5, selfSubmittedAt: NOW })],
    ['EVR-03: selfComments é opcional no envio (Q-07)', state({ selfScore: 2 }), 'SELF', { submit: true }, state({ selfScore: 2, selfSubmittedAt: NOW })],
    ['EVR-04: gestor envia o rascunho salvo', MANAGER_DRAFT, 'MANAGER', { submit: true }, { ...MANAGER_DRAFT, managerSubmittedAt: NOW }],
    [
      'EVR-04: gestor preenche e envia no mesmo payload',
      OPEN,
      'MANAGER',
      { managerScore: 4, managerFeedback: 'Ótimo semestre.', submit: true },
      state({ managerScore: 4, managerFeedback: 'Ótimo semestre.', managerSubmittedAt: NOW }),
    ],
    // EVR-04: conclusão nas duas ordens
    [
      'EVR-04: avaliado envia por último → CONCLUIDA',
      { ...MANAGER_SUBMITTED, selfScore: 5 },
      'SELF',
      { submit: true },
      { ...MANAGER_SUBMITTED, selfScore: 5, selfSubmittedAt: NOW, status: 'CONCLUIDA' },
    ],
    [
      'EVR-04: gestor envia por último → CONCLUIDA',
      SELF_SUBMITTED,
      'MANAGER',
      { managerScore: 2, managerFeedback: 'Precisa evoluir.', submit: true },
      { ...SELF_SUBMITTED, managerScore: 2, managerFeedback: 'Precisa evoluir.', managerSubmittedAt: NOW, status: 'CONCLUIDA' },
    ],
  ])('[EVAL-40] %s', (_description, current, part, changes, expected) => {
    expect(applyEvaluationChanges(current, part, changes, NOW)).toEqual(expected);
  });
});

describe('applyEvaluationChanges: envio incompleto (EVR-03)', () => {
  it.each<readonly [string, EvaluationState, EvaluationPart, EvaluationChanges, readonly string[]]>([
    ['avaliado envia sem nota no rascunho', state({ selfComments: 'Só texto' }), 'SELF', { submit: true }, ['selfScore']],
    ['avaliado limpa a nota no mesmo payload do envio', SELF_DRAFT, 'SELF', { selfScore: null, submit: true }, ['selfScore']],
    ['gestor envia sem nota e sem feedback', OPEN, 'MANAGER', { submit: true }, ['managerScore', 'managerFeedback']],
    ['gestor envia só com a nota (Q-07)', state({ managerScore: 3 }), 'MANAGER', { submit: true }, ['managerFeedback']],
    ['gestor envia só com o feedback', state({ managerFeedback: 'Parecer' }), 'MANAGER', { submit: true }, ['managerScore']],
    ['gestor limpa o feedback no mesmo payload do envio', MANAGER_DRAFT, 'MANAGER', { managerFeedback: null, submit: true }, ['managerFeedback']],
  ])('[EVAL-40] %s → 400 com os campos faltantes', (_description, current, part, changes, fields) => {
    const messages: Record<string, string> = {
      selfScore: MISSING_SCORE,
      managerScore: MISSING_SCORE,
      managerFeedback: MISSING_FEEDBACK,
    };

    const error = thrownBy(() => applyEvaluationChanges(current, part, changes, NOW));

    expect(error).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect((error as { details?: unknown }).details).toEqual(fields.map((field) => ({ field, message: messages[field] })));
  });
});

describe('applyEvaluationChanges: partes travadas (EVR-05/06)', () => {
  it.each<readonly [string, EvaluationState, EvaluationPart, EvaluationChanges]>([
    ['self enviada: avaliado edita o comentário', SELF_SUBMITTED, 'SELF', { selfComments: 'Mudei de ideia' }],
    ['self enviada: avaliado reenvia a MESMA nota', SELF_SUBMITTED, 'SELF', { selfScore: 4 }],
    ['self enviada: avaliado envia de novo', SELF_SUBMITTED, 'SELF', { submit: true }],
    ['gestor enviado: gestor edita o feedback', MANAGER_SUBMITTED, 'MANAGER', { managerFeedback: 'Outro' }],
    ['gestor enviado: gestor envia de novo', MANAGER_SUBMITTED, 'MANAGER', { submit: true }],
    ['CONCLUIDA: avaliado edita', CONCLUDED, 'SELF', { selfComments: 'Depois' }],
    ['CONCLUIDA: gestor edita', CONCLUDED, 'MANAGER', { managerScore: 5 }],
  ])('[EVAL-40] %s → 409 EVALUATION_LOCKED', (_description, current, part, changes) => {
    expect(thrownBy(() => applyEvaluationChanges(current, part, changes, NOW))).toMatchObject({
      statusCode: 409,
      code: 'EVALUATION_LOCKED',
      message: 'Esta parte da avaliação já foi enviada e não pode ser alterada.',
    });
  });

  it('[EVAL-40] o travamento de uma parte NÃO trava a outra', () => {
    expect(applyEvaluationChanges(MANAGER_SUBMITTED, 'SELF', { selfScore: 1 }, NOW)).toEqual({
      ...MANAGER_SUBMITTED,
      selfScore: 1,
    });
  });

  it('[EVAL-40] não muta o estado recebido (função pura)', () => {
    const current = structuredClone(SELF_DRAFT);
    const snapshot = structuredClone(current);

    applyEvaluationChanges(current, 'SELF', { selfScore: 1, submit: true }, NOW);

    expect(current).toEqual(snapshot);
  });
});
