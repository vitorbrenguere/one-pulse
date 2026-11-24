/**
 * Marcador da etapa RED do TDD: stubs que existem só para o `tsc --noEmit` ficar limpo.
 * Lançam SEMPRE, para que nenhum teste fique verde por acidente (falso verde).
 * Deve desaparecer do código na etapa GREEN (um grep por `NotImplementedError` precisa voltar vazio).
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`[RED] ${what} ainda não foi implementado.`);
    this.name = 'NotImplementedError';
  }
}

export function notImplemented(what: string): never {
  throw new NotImplementedError(what);
}
