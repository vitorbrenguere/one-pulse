# CLAUDE.md — OnePulse

> Este arquivo é a "constituição" do repositório. Toda sessão (humana ou de IA) deve lê-lo antes de agir.

## 1. Propósito

**OnePulse** é uma plataforma Full-Stack de Gestão de Pessoas: **PDI** (Plano de Desenvolvimento Individual) e **Avaliação de Desempenho**. Simula um produto real de RH/cultura organizacional, com qualidade de engenharia de mercado: especificações antes de código, testes antes de implementação e decisões documentadas.

Fonte da verdade do domínio: [`specs/00-architecture.spec.md`](specs/00-architecture.spec.md).

## 2. Regras de Ouro (não negociáveis)

1. **Sem spec, sem código.** Nenhuma feature começa sem um arquivo aprovado em `/specs`.
2. **Sem teste vermelho, sem implementação.** Os testes que cobrem os critérios de aceite da spec são escritos primeiro e precisam falhar antes da implementação.
3. **A spec manda.** Se a implementação precisar divergir da spec, **pare**, atualize a spec, peça validação e só então continue. Nunca "corrija" a spec em silêncio para fazer o código passar.
4. **Não enfraqueça testes** para deixá-los verdes (sem `skip`, sem assertivas mais frouxas, sem mocks que escondam o comportamento real) sem aprovação explícita.
5. **Segurança por padrão:** senha só como hash bcrypt; JWT apenas em cookie `httpOnly`; SQL sempre parametrizado; autorização verificada no back-end em toda rota.
6. **Passos pequenos e verificáveis:** um comportamento por ciclo, um commit por passo lógico.
7. **Nada de segredos no repositório.** Configuração via `.env` (somente `.env.example` é versionado).
8. **Na dúvida, pergunte.** Ambiguidade na spec é resolvida com o dono do produto, não por suposição.

## 3. Fluxo Obrigatório: SDD → TDD → Implementação

```
1. SPEC     → criar/atualizar specs/NN-<feature>.spec.md
              (objetivo, regras de negócio, contrato de API, critérios de aceite Given/When/Then)
              ⛔ Aguardar validação humana.
2. RED      → escrever testes que mapeiam 1:1 os critérios de aceite. Rodar e confirmar que FALHAM.
3. GREEN    → implementar o mínimo para passar.
4. REFACTOR → melhorar o design com os testes verdes.
5. VERIFY   → lint + typecheck + suíte completa verdes. Atualizar a spec com o status.
```

**Convenção de specs:** `specs/NN-<kebab-case>.spec.md` (ex.: `01-auth.spec.md`). Cada critério de aceite tem um ID (`AUTH-01`, `PDI-03`...) que é referenciado no nome do teste correspondente:

```ts
it('[AUTH-02] retorna 401 quando a senha está incorreta', ...)
```

**Definition of Done:** spec aprovada · todos os critérios de aceite com teste · testes, lint e typecheck verdes · sem `any` ou `console.log` esquecidos · spec marcada como `Implementada`.

## 4. Stack

| Camada | Tecnologias |
|---|---|
| Infra | Docker, Docker Compose, MySQL 8.0 |
| Back-end | Node.js (LTS), Express, TypeScript, mysql2, JWT (cookie httpOnly), bcrypt, Zod, Vitest, Supertest |
| Front-end | React (Vite), TypeScript, Tailwind CSS, TanStack Query, React Router, Lucide React, Vitest + Testing Library |

## 5. Padrões de Código

**Idioma:** código (identificadores, arquivos, commits) em **inglês**; documentação e specs em **português**. Exceção: valores de enum do domínio seguem a spec (`COLABORADOR`, `GESTOR`).

**TypeScript**
- `strict: true`. Proibido `any`; use `unknown` + narrowing.
- Tipos de entrada são derivados dos schemas Zod (`z.infer`), uma única fonte da verdade.
- Nomes: `camelCase` para variáveis/funções, `PascalCase` para tipos/componentes, `UPPER_SNAKE_CASE` para constantes, `kebab-case` para arquivos no back-end, `PascalCase.tsx` para componentes.
- Banco em `snake_case`; o mapeamento para `camelCase` acontece **somente** no repository.

**Back-end**
- Arquitetura em camadas com dependência em uma só direção: `routes → controller → service → repository`.
  - **Controller:** HTTP apenas (lê req, chama service, devolve res). Sem regra de negócio.
  - **Service:** regras de negócio e autorização de domínio. Não conhece Express.
  - **Repository:** único lugar com SQL. Queries sempre parametrizadas (`?`).
- Validação de entrada com Zod em middleware, antes do controller.
- Erros: lançar `AppError(statusCode, code, message)`; um único middleware de erro devolve o envelope padrão:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
  ```
- Status HTTP semânticos: 200/201/204, 400 (validação), 401 (não autenticado), 403 (sem permissão), 404, 409 (conflito), 500.
- Nunca retornar `password_hash` em nenhuma resposta.

**Front-end**
- Estado de servidor **só** via TanStack Query (sem duplicar em `useState`/contexto).
- Chamadas HTTP centralizadas em `services/` com `credentials: 'include'` (cookie JWT).
- Componentes pequenos e focados; lógica em hooks (`useXxx`).
- Acessibilidade básica: labels em inputs, foco visível, HTML semântico.

**Git:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`), com escopo quando fizer sentido (`feat(auth): ...`).

## 6. Arquitetura de Pastas (alvo)

```
one-pulse/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── specs/                         # SDD: fonte da verdade
│   ├── 00-architecture.spec.md
│   └── NN-<feature>.spec.md
├── backend/
│   ├── src/
│   │   ├── app.ts                 # cria o app Express (sem listen → testável com Supertest)
│   │   ├── server.ts              # bootstrap/listen
│   │   ├── config/                # env (validado com Zod), conexão com o banco
│   │   ├── shared/                # errors/, middlewares/ (auth, rbac, validate, error), utils/
│   │   └── modules/               # organização por feature (vertical slices)
│   │       ├── auth/
│   │       │   ├── auth.routes.ts
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.schemas.ts
│   │       │   └── auth.service.test.ts
│   │       ├── users/
│   │       ├── pd-goals/
│   │       └── evaluations/
│   ├── database/
│   │   ├── migrations/            # SQL versionado (NNN_descricao.sql)
│   │   └── seeds/
│   └── tests/
│       ├── integration/           # Supertest + banco de teste real
│       └── helpers/               # factories, reset do banco, login helper
└── frontend/
    └── src/
        ├── main.tsx / App.tsx
        ├── routes/                # definição de rotas + guards por papel
        ├── features/              # por domínio: auth/, pdi/, evaluations/, team/
        │   └── pdi/
        │       ├── components/
        │       ├── hooks/         # useGoals, useCreateGoal (TanStack Query)
        │       ├── pages/
        │       └── api.ts
        ├── components/ui/         # componentes genéricos reutilizáveis
        ├── services/              # http client base
        ├── lib/                   # queryClient, utils
        └── types/
```

## 7. Estratégia de Testes

- **Unitários (Vitest):** services e regras de negócio, com repositories substituídos por fakes.
- **Integração (Vitest + Supertest):** rotas HTTP contra um **banco MySQL de teste real** (`onepulse_test`), cobrindo autenticação, RBAC e contratos da spec.
- **Front-end (Vitest + Testing Library):** comportamento visível ao usuário, não detalhes de implementação.
- Testes independentes e determinísticos: cada teste prepara e limpa o próprio estado.

## 8. Comandos

```bash
cp .env.example .env          # primeira vez
docker compose up -d          # sobe o MySQL (onepulse_db)
docker compose ps             # deve exibir "healthy"
docker compose down           # para (os dados permanecem no volume)
docker compose down -v        # ⚠️ apaga o volume e os dados
```
_(Comandos de back-end e front-end serão adicionados quando cada projeto for inicializado.)_

## 9. Como a IA deve trabalhar neste repo

- Antes de codar, leia a spec relevante e confirme o ID dos critérios de aceite que serão cobertos.
- Mostre os testes falhando antes de implementar.
- Ao terminar uma etapa, apresente um resumo e **aguarde validação** antes de avançar de fase.
- O usuário está aprendendo: explique o **porquê** das decisões, cite trade-offs e alternativas descartadas.
