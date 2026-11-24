import { describe, expect, it } from 'vitest';
import { splitFormErrors } from './form-errors';

describe('splitFormErrors (spec 05 §4.3)', () => {
  it('[UI-07] campos do formulário viram erro de campo; body e desconhecidos vão para o banner', () => {
    const result = splitFormErrors(
      [
        { field: 'email', message: 'E-mail inválido.' },
        { field: 'body', message: 'Informe ao menos um campo para atualizar.' },
        { field: 'role', message: 'Campo não permitido.' },
        { field: 'password', message: 'Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.' },
      ],
      ['name', 'email', 'password'],
    );

    expect(result).toEqual({
      fieldErrors: {
        email: 'E-mail inválido.',
        password: 'Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.',
      },
      formErrors: ['Informe ao menos um campo para atualizar.', 'Campo não permitido.'],
    });
  });

  it('[UI-07] com mais de uma mensagem para o mesmo campo, mantém a primeira', () => {
    const result = splitFormErrors(
      [
        { field: 'title', message: 'Primeira.' },
        { field: 'title', message: 'Segunda.' },
      ],
      ['title'],
    );

    expect(result).toEqual({ fieldErrors: { title: 'Primeira.' }, formErrors: [] });
  });

  it('[UI-07] sem details: nada a exibir', () => {
    expect(splitFormErrors([], ['title'])).toEqual({ fieldErrors: {}, formErrors: [] });
  });
});
