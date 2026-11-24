# 02 — Usuários, Hierarquia e Seed

| Campo | Valor |
|---|---|
| Status | 🏁 Concluída: USER-01..33 cobertos, 206 testes verdes na suíte completa (2026-11-24) |
| Versão | 1.0.0 |
| Data | 2026-11-24 |
| Depende de | [`00-architecture.spec.md`](00-architecture.spec.md) v1.1.0 (§2 RBAC, §3.2 `users`, USR-INV-01) · [`01-auth.spec.md`](01-auth.spec.md) (sessão, `requireAuth`, `UserDTO`, envelope de erro) |
| Branch | `feat/phase-2-users` |

---

## 1. Objetivo

Dar ao **GESTOR** visibilidade sobre a própria equipe, permitir que **qualquer usuário** consulte e edite o próprio perfil básico, e entregar um **seed idempotente** com uma hierarquia mínima de **duas equipes** (2 gestores e 3 liderados) para desenvolvimento, testes manuais e demonstração do isolamento entre equipes.

Esta fase também entrega duas peças de autorização que serão reutilizadas nas fases 3 (PDI) e 4 (Avaliações):

1. o middleware **`requireRole(...roles)`**, que gera `403` por papel (RBAC-02);
2. a política **`canViewUser(viewer, target)`**, que decide por relação de liderança e é aplicada com `404` (RBAC-03).

**Fora do escopo desta fase:**
- alterar `role` ou `manager_id` via API (spec 00 §2.1: somente via seed no MVP);
- paginação, busca e ordenação customizável na listagem de equipe;
- visão de liderados indiretos (subordinados de subordinados);
- o colaborador consultar o perfil do próprio gestor (veja a Q-02);
- `413 PAYLOAD_TOO_LARGE` (registrado no backlog na Fase 1).

---

## 2. Regras de Domínio

### 2.1 Definições

| Termo | Definição |
|---|---|
| **Liderado direto** | Usuário `u` tal que `u.manager_id = gestor.id` **e** `u.is_active = TRUE`. |
| **Equipe** | Conjunto dos liderados diretos de um gestor. Liderados indiretos **não** fazem parte da equipe. |
| **Viewer** | Usuário autenticado que faz a requisição (vem do `requireAuth`, nunca do corpo ou da URL). |

### 2.2 Política de visibilidade: `canViewUser(viewer, target)`

Função **pura** (sem I/O), em `users.policy.ts`. Retorna `true` se, e somente se:

```
target.isActive
AND (
  target.id === viewer.id                                         -- o próprio usuário
  OR (viewer.role === 'GESTOR' AND target.managerId === viewer.id) -- liderado direto
)
```

| Viewer ↓ / Target → | Ele mesmo | Liderado direto ativo | Liderado direto inativo | Liderado indireto | Par da mesma equipe | Próprio gestor | Outro time |
|---|---|---|---|---|---|---|---|
| **COLABORADOR** | ✅ | n/a | n/a | n/a | ❌ | ❌ | ❌ |
| **GESTOR** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Por que `managerId === viewer.id` exige `role === 'GESTOR'`?** Pela USR-INV-02 (§2.3), só um GESTOR pode ter liderados. A checagem dupla é defesa em profundidade: mesmo que um dado inconsistente entre no banco, um COLABORADOR nunca ganha acesso.

### 2.3 Invariantes de hierarquia (validadas no seed; não há API de escrita nesta fase)

- **USR-INV-01** (spec 00): `manager_id <> id`, ninguém é gestor de si mesmo.
- **USR-INV-02** (nova): se `manager_id` está preenchido, o usuário referenciado tem `role = 'GESTOR'`.

### 2.4 Regras de resposta para recursos fora do escopo (RBAC-03)

Para `GET /users/:id`, as situações abaixo produzem **exatamente a mesma resposta** (mesmo status, `code` e `message`), sem diferença perceptível pelo cliente:

- o usuário não existe;
- o usuário existe, mas está inativo;
- o usuário existe, mas não é o próprio viewer nem liderado direto dele.

```json
{ "error": { "code": "NOT_FOUND", "message": "Usuário não encontrado." } }
```

### 2.5 Novos códigos de erro (somam-se ao catálogo da spec 01 §2.5)

| HTTP | `code` | Quando |
|---|---|---|
| 403 | `FORBIDDEN` | O papel do viewer não permite a **ação** (ex.: COLABORADOR listando equipe). Mensagem: *"Você não tem permissão para esta ação."* |
| 404 | `NOT_FOUND` | O recurso não existe **ou** está fora do escopo do viewer (RBAC-03). Rotas inexistentes também usam este código (já implementado na Fase 1). |

> **403 × 404:** `403` responde *"você não pode fazer ISSO"* (ação, decidida pelo papel). `404` responde *"ESSE recurso não existe para você"* (instância, decidida pela relação). Listar a equipe é uma ação, então gera 403; ver o usuário 42 é uma instância, então gera 404.

---

## 3. Schemas de Validação (Zod)

### 3.1 `userIdParamSchema` (`:id` na URL)

| Regra | Motivo |
|---|---|
| String casando `^[1-9]\d{0,9}$` | Rejeita `abc`, `0`, `-1`, `1.5`, `1e3`, ` 1`, `01` (zero à esquerda). **Não** usar `z.coerce.number()`, que aceitaria `"1e3"` como 1000 e `" 1"` como 1. |
| Valor convertido ≤ `4294967295` | Limite de `INT UNSIGNED`. Acima disso o registro não pode existir: a resposta é `400`, sem consultar o banco. |

Erro → `400 VALIDATION_ERROR` com `details: [{ field: "id", message: "ID de usuário inválido." }]`.

### 3.2 `updateProfileSchema` (`PATCH /users/me`): `strictObject`

| Campo | Regras | Mensagem |
|---|---|---|
| `name` | opcional · string · `trim()` · 2 a 120 caracteres (mesma regra do cadastro) | "Nome deve ter entre 2 e 120 caracteres." |
| `jobTitle` | opcional · `null` **ou** string · `trim()` · 1 a 120 caracteres | "Cargo deve ter entre 1 e 120 caracteres, ou null para remover." |
| — | **pelo menos um** dos campos presente | "Informe ao menos um campo para atualizar." (`field: "body"`) |

- `jobTitle: null` **remove** o cargo. `jobTitle: ""` ou `"   "` é **inválido** (400); para remover, envie `null` explicitamente.
- Qualquer outro campo (`email`, `role`, `managerId`, `isActive`, `password`, `id`…) gera `400` (mass assignment), com `details[].field` = nome do campo.

---

## 4. Contrato da API

Prefixo: `/api/v1/users`. **Todas** as rotas exigem autenticação (`requireAuth` da Fase 1): sem sessão válida → `401 UNAUTHENTICATED`.

> **Ordem de registro das rotas:** `/team` e `/me` são registradas **antes** de `/:id`. Não existe `GET /users/me` (o endpoint canônico é `GET /auth/me`), então `GET /users/me` cai em `/:id` e responde `400`, porque `"me"` não é um ID válido.

### 4.1 `GET /api/v1/users/team`: somente `GESTOR`

Middlewares: `requireAuth` → `requireRole('GESTOR')`.

**Response `200 OK`**
```json
{
  "users": [
    { "id": 2, "name": "Camila Rocha", "email": "camila@onepulse.dev", "role": "COLABORADOR", "managerId": 1, "jobTitle": "Desenvolvedora Pleno", "createdAt": "2026-11-22T12:00:00.000Z" },
    { "id": 3, "name": "Carlos Lima",  "email": "carlos@onepulse.dev", "role": "COLABORADOR", "managerId": 1, "jobTitle": "Desenvolvedor Júnior", "createdAt": "2026-11-22T12:00:00.000Z" }
  ]
}
```
- Apenas liderados **diretos** e **ativos** (§2.1).
- Ordenação: `name ASC, id ASC` (desempate determinístico).
- Equipe vazia → `200 { "users": [] }` (nunca `404`).
- COLABORADOR → `403 FORBIDDEN`.

### 4.2 `GET /api/v1/users/:id`: qualquer papel, filtrado pela política

Middlewares: `requireAuth` → `validateParams(userIdParamSchema)`.

**Response `200 OK`**: `{ "user": UserDTO }` se `canViewUser(viewer, target)` for verdadeiro; caso contrário, `404 NOT_FOUND` (§2.4).

Ordem de avaliação: `401` (sessão) → `400` (formato do ID) → `404` (existência + política). O `400` não vaza informação, porque depende só do formato da URL.

### 4.3 `PATCH /api/v1/users/me`: qualquer papel

Middlewares: `requireAuth` → `validateBody(updateProfileSchema)`.

**Request** (exemplos)
```json
{ "name": "Ana Souza Lima", "jobTitle": "Desenvolvedora Júnior" }
{ "jobTitle": null }
```
**Response `200 OK`**: `{ "user": UserDTO }` com os dados **após** a atualização (relidos do banco). Os campos omitidos permanecem inalterados.

---

## 5. Seed de Desenvolvimento (`npm run seed`)

### 5.1 Comportamento

| Item | Regra |
|---|---|
| Comando | `npm run seed`, que executa `tsx --env-file=.env database/seed.ts` |
| Banco alvo | O de `DB_NAME` (por padrão, `onepulse_db`). |
| Pré-requisito | Aplica as migrations pendentes antes de semear (reutiliza `runMigrations`). |
| Produção | **Recusa** executar com `NODE_ENV=production`: sai com código ≠ 0 e uma mensagem explicativa, sem tocar no banco. |
| Senha | `SEED_USER_PASSWORD` do `.env`; se ausente, usa `onepulse123`. Deve respeitar a política de senha do cadastro (spec 01 §3.1), senão o seed falha. Hash com `BCRYPT_ROUNDS`. |
| Transação | Tudo ou nada: se qualquer passo falhar, nenhuma alteração permanece. |
| Escopo | Toca **somente** os 5 e-mails do seed; nunca apaga nem altera outros usuários. |
| Saída | Imprime a tabela `papel / nome / e-mail` e a senha usada (é ambiente de dev). |

### 5.2 Dados

| Equipe | Papel | Nome | E-mail | Cargo | Gestor |
|---|---|---|---|---|---|
| Engenharia | GESTOR | Gabriela Martins | `gabriela@onepulse.dev` | Engineering Manager | — |
| Engenharia | COLABORADOR | Carlos Lima | `carlos@onepulse.dev` | Desenvolvedor Júnior | Gabriela |
| Engenharia | COLABORADOR | Camila Rocha | `camila@onepulse.dev` | Desenvolvedora Pleno | Gabriela |
| Produto | GESTOR | Gustavo Alves | `gustavo@onepulse.dev` | Product Manager | — |
| Produto | COLABORADOR | Diego Ferreira | `diego@onepulse.dev` | Analista de Produto | Gustavo |

**Demonstração de isolamento (manual):** faça login como Gabriela e chame `GET /users/<id do Diego>`. A resposta esperada é `404`, idêntica à de um id inexistente. `GET /users/team` como Gustavo retorna apenas Diego.

### 5.3 Idempotência: o seed *converge* para o estado desejado

Executar o seed N vezes produz o **mesmo estado** que executá-lo uma vez:

- **upsert por e-mail** (`INSERT … ON DUPLICATE KEY UPDATE`): os `id`s existentes são preservados e não há duplicatas;
- se alguém alterou um usuário do seed (nome, cargo, `manager_id`, desativou ou trocou a senha), a próxima execução **restaura** os valores da tabela §5.2, com `is_active = TRUE` e a senha do seed.

### 5.4 Validação dos dados do seed: `validateSeedUsers(users)` (função pura)

Antes de qualquer escrita, verifica a lista declarada. Se algo falhar, lança um erro cuja mensagem contém o **identificador da regra** e, quando a regra se refere a um usuário, o **e-mail** dele:

| Identificador | Regra |
|---|---|
| `SEED-DUP-EMAIL` | E-mails únicos na lista (comparação sem diferenciar maiúsculas). |
| `USR-INV-01` | Ninguém é gestor de si mesmo (`managerEmail ≠ email`). |
| `SEED-UNKNOWN-MANAGER` | O `managerEmail` referenciado existe na própria lista. |
| `USR-INV-02` | O gestor referenciado tem `role = GESTOR`. |
| `SEED-WEAK-PASSWORD` | A senha do seed respeita a política de cadastro (spec 01 §3.1). Esta regra não cita e-mail, porque a senha é única para todos. |

### 5.5 Interface (para testabilidade)

```ts
runSeed(options: {
  nodeEnv: string;                       // 'production' → rejeita (USER-30)
  password: string;
  bcryptRounds: number;
  connect: () => Promise<Connection>;    // injetado: o teste verifica que não é chamado em produção
  users?: readonly SeedUser[];           // padrão: a lista oficial da §5.2
}): Promise<{ users: Array<{ id: number; email: string; role: UserRole }> }>
```

O CLI (`npm run seed`) apenas lê o `.env`, monta essas opções e imprime o resultado.

---

## 6. Critérios de Aceite

> Convenção da Fase 1: `it('[USER-07] ...')`. **I** = integração (Supertest + `onepulse_test`); **U** = unitário.
> Notação dos cenários: **G** = gestor, **C1/C2** = liderados diretos de G, **Ci** = liderado inativo de G, **G2** = outro gestor, **X** = colaborador da equipe de G2, **N** = liderado de C1 (indireto para G; dado inconsistente, porque C1 não é GESTOR).

### 6.1 Equipe: `GET /users/team`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-01** | G com C1 e C2 ativos | `200`, `{ users }` com exatamente C1 e C2 no formato `UserDTO` (`managerId = G.id`), ordenados por `name ASC, id ASC`. | I |
| **USER-02** | G com Ci (inativo) | Ci **não** aparece. | I |
| **USER-03** | Existem G2, X e N | Nem G (ele mesmo), nem X (outro time), nem N (indireto) aparecem. | I |
| **USER-04** | G2 sem liderados | `200 { "users": [] }`. | I |
| **USER-05** | Viewer COLABORADOR | `403 FORBIDDEN`. | I |
| **USER-06** | Sem cookie de sessão | `401 UNAUTHENTICATED`. | I |

### 6.2 Detalhe: `GET /users/:id`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-07** | Viewer consulta o próprio id (G e C1, via `it.each`) | `200 { user: UserDTO }` dele mesmo. | I |
| **USER-08** | G consulta C1 | `200 { user }` de C1. | I |
| **USER-09** | G consulta X (outro time) | `404 NOT_FOUND` com corpo **idêntico** ao do USER-14. | I |
| **USER-10** | C1 consulta C2 (par da mesma equipe) | `404`, corpo idêntico ao do USER-14. | I |
| **USER-11** | C1 consulta G (o próprio gestor) | `404`, corpo idêntico ao do USER-14. | I |
| **USER-12** | G consulta N (indireto) | `404`, corpo idêntico ao do USER-14. | I |
| **USER-13** | G consulta Ci (liderado inativo) | `404`, corpo idêntico ao do USER-14. | I |
| **USER-14** | G consulta um id inexistente (ex.: `999999`) | `404 { error: { code: "NOT_FOUND", message: "Usuário não encontrado." } }`. | I |
| **USER-15** | `:id` ∈ `abc`, `0`, `-1`, `1.5`, `1e3`, `01`, `4294967296`, `me` | `400 VALIDATION_ERROR`, `details` contém `field: "id"`. | I (`it.each`) + U (schema) |
| **USER-16** | Sem cookie de sessão | `401 UNAUTHENTICATED` (antes da validação do id). | I |
| **USER-17** | Matriz completa da §2.2 sobre `canViewUser` | Retorna exatamente os ✅/❌ da tabela, incluindo a defesa em profundidade (COLABORADOR com `managerId` apontando para ele → `false`). | U (`it.each`) |

### 6.3 Perfil: `PATCH /users/me`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-18** | `{ name, jobTitle }` válidos | `200 { user }` atualizado; os valores ficam persistidos no banco e o `GET /auth/me` seguinte reflete a mudança. | I |
| **USER-19** | `{ jobTitle: null }` com cargo preenchido | `200`, `jobTitle: null` no corpo e no banco. | I |
| **USER-20** | `{ name }` apenas | O nome muda e o `jobTitle` anterior é preservado. | I |
| **USER-21** | Campo proibido (`email`, `role`, `managerId`, `isActive`, `password`) | `400 VALIDATION_ERROR` com `details[].field` = o campo; **nada** muda no banco. | I (`it.each`) |
| **USER-22** | Corpo `{}`, `name` com 1 caractere, `jobTitle: ""`, `jobTitle: "   "`, `jobTitle` com 121 caracteres | `400 VALIDATION_ERROR`. | I + U (schema) |
| **USER-23** | Sem cookie de sessão | `401 UNAUTHENTICATED`. | I |

### 6.4 Middleware `requireRole`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-24** | `requireRole('GESTOR')` com `req.user` GESTOR / COLABORADOR / ausente | Chama `next()` / lança `403 FORBIDDEN` / lança `401 UNAUTHENTICATED` (protege contra esquecer o `requireAuth` antes). | U |

### 6.5 Seed

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-25** | Banco sem os usuários do seed, executo `runSeed` | Existem exatamente os 5 usuários da §5.2, com papéis, cargos e `manager_id` corretos e `is_active = TRUE`. | I |
| **USER-26** | Executo `runSeed` duas vezes | Continuam 5 usuários do seed, com os **mesmos ids** da primeira execução. | I |
| **USER-27** | Altero o nome e a senha de Carlos, desativo Camila e zero o `manager_id` dos dois; executo `runSeed` | Todos os valores voltam aos da §5.2, e a senha volta a ser a do seed (convergência). | I |
| **USER-28** | Existe um usuário fora do seed | O seed não o altera (linha idêntica antes e depois). | I |
| **USER-29** | Após o seed | `POST /auth/login` com `carlos@onepulse.dev` e a senha do seed responde `200`; `GET /users/team` como Gabriela retorna **só** Camila e Carlos, e como Gustavo retorna **só** Diego (isolamento entre equipes). | I |
| **USER-30** | `NODE_ENV=production` | `runSeed` rejeita **antes** de abrir conexão ou executar SQL (`connect` nunca é chamado). | U |
| **USER-31** | `validateSeedUsers` com: e-mail duplicado, gestor de si mesmo, gestor inexistente na lista, gestor com papel COLABORADOR, senha fora da política | Lança um erro contendo o identificador da regra (§5.4) e o e-mail envolvido; a lista oficial da §5.2 passa. | U (`it.each`) |
| **USER-33** | Uma lista de seed em que o **último** usuário viola uma restrição do banco (`job_title` com mais de 120 caracteres, que passa pelo `validateSeedUsers`) | `runSeed` rejeita e **nenhum** usuário da lista fica persistido (rollback da transação). | I |

### 6.6 Transversais

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **USER-32** | Todas as respostas de sucesso de `/users/*` | Nenhuma chave `password`, `passwordHash`, `password_hash`, `isActive` ou `is_active`, nem hash bcrypt, em qualquer nível (reutiliza o helper do AUTH-26). | I |

---

## 7. Decisões desta Spec

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D-01 | `GET /users/team` | `GET /users` filtrado pelo papel | A URL expressa a intenção. `GET /users` fica livre para uma futura listagem de admin, sem mudar a semântica de uma rota existente. |
| D-02 | `PATCH /users/me` | `PATCH /users/:id` | Elimina uma classe inteira de IDOR: o alvo é sempre o próprio viewer, e não há id na URL para manipular. |
| D-03 | Política como função pura (`canViewUser`) | Checagem embutida no SQL (`WHERE id = ? AND manager_id = ?`) | Testável em unidade com a matriz completa e reutilizável nas fases 3 e 4 (PDI e avaliações seguem a mesma relação). O custo é 1 consulta por PK, desprezível. |
| D-04 | Liderado inativo → `404` | Mostrar o inativo ao gestor | Coerente com a listagem (que o omite) e com a Fase 1 (um inativo "não existe" para o sistema). O histórico de inativos fica para uma visão de admin futura. |
| D-05 | Validação de `:id` por regex, não `z.coerce` | `z.coerce.number().int().positive()` | O coerce aceita `"1e3"`, `" 1"` e `"0x10"`. A regex é explícita e fácil de testar. |
| D-06 | Seed por upsert que converge | Apagar e recriar | Preserva os ids: as metas de PDI e as avaliações das fases seguintes não ficam órfãs ao re-semear. |
| D-07 | `jobTitle: ""` é inválido | Converter `""` em `null` | Mudanças implícitas surpreendem o cliente; remover o cargo é uma ação explícita (`null`). |

---

## 8. Decisões de Produto (resolvidas em 2026-11-24)

- **Q-01: Paginação da equipe.** Sem paginação no MVP (equipes pequenas). Fica registrada como débito técnico.
- **Q-02: o colaborador ver o perfil do próprio gestor.** Fora desta fase. Se a UI precisar, entra na Fase 5 como regra explícita na política (`target.id === viewer.managerId`), com teste próprio.
- **Q-03: segundo time no seed.** Aprovado: Gustavo (GESTOR) e Diego (liderado dele), na §5.2. Os testes automatizados continuam criando os próprios dados.

---

## 9. Plano de Testes (prévia para a etapa RED)

```
backend/
├── src/modules/users/
│   ├── users.policy.test.ts           # USER-17
│   └── users.schemas.test.ts          # USER-15 (U), USER-22 (U)
├── src/shared/middlewares/
│   └── require-role.test.ts           # USER-24
├── database/
│   ├── seed.ts                        # runSeed, validateSeedUsers, SEED_USERS + CLI
│   └── seed.test.ts                   # USER-30, USER-31 (U)
└── tests/
    ├── helpers/
    │   └── db.ts                      # + insertUser({ managerId }), fixture de hierarquia (G, C1, C2, Ci, G2, X, N)
    └── integration/users/
        ├── team.test.ts               # USER-01..06
        ├── get-user.test.ts           # USER-07..16
        ├── update-profile.test.ts     # USER-18..23
        ├── seed.test.ts               # USER-25..29, USER-33
        └── cross-cutting.test.ts      # USER-32
```
