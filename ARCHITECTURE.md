# ARCHITECTURE — `admin` (PlayCK)

**Fonte: análise direta do código.** Data: 2026-08-25.

Planta **AS-IS**. Intenção arquitetural vive em `TARGET_ARCHITECTURE.md`
(raiz do workspace) + ADRs em `DECISIONS.md`. Divergência entre este
documento e o código é defeito **deste documento**.

**Quem usa:** `company_admin` — o dono/gestor da escola ou arena · **Produção:** `admin.playck.com.br`

Painel de operação: pessoas, quadras, turmas, pagamentos, horário de
funcionamento e a agenda mensal. É a tela onde a escola trabalha todo dia.

---

## 1. Stack real

| Lib | Versão | Papel |
|---|---|---|
| `next` | 16.3.0 | framework (App Router) |
| `react`, `react-dom` | 19.2.8 | UI |
| `radix-ui` | ^1.6.7 | primitivos acessíveis |
| `shadcn` | ^4.16.2 | componentes gerados em `components/ui/` |
| `tailwind-merge`, `clsx`, `class-variance-authority` | — | composição de classes |
| `lucide-react` | ^1.29.0 | ícones |

**NÃO existem no projeto:** biblioteca de estado global (Redux, Zustand,
Jotai, Recoil), React Query/SWR, form library (React Hook Form, Formik),
cliente HTTP (axios), i18n, biblioteca de datas (date-fns, dayjs — usa-se
`Intl` e `Date` nativos), Storybook, Sentry.

## 2. Visão geral e fluxo de referência

```
page.tsx (server component, fino)
   → components/*.tsx ("use client")
       → lib/api-client.ts  (authFetch: token, refresh, 401/403)
           → back (api.playck.com.br)
```

**Fluxo de referência — cadastrar aluno e entregar o acesso** (o molde a
replicar):

1. `app/(app)/pessoas/alunos/novo/page.tsx` renderiza
   `components/create-student-form.tsx` (client component);
2. o form chama `lib/api-client.ts::createStudent`, que passa por
   `authFetch` (token, renovação de sessão, desvio de senha temporária);
3. **a tela não navega ao concluir**: a senha temporária vem uma única vez
   na resposta, e sair da tela a perderia. `SenhaTemporariaCard` mostra a
   senha com copiar e envio por WhatsApp;
4. sair é escolha explícita de quem já copiou.

## 3. Rotas e componentes

| Rota | Componente | Papel |
|---|---|---|
| `/login` | `login-form` | entrada |
| `/dashboard` | `dashboard-summary` + `evasao-card` | 3 KPIs do período e, desde a **SPEC-015**, o cartão "alunos em risco" — a única tela do Admin que puxa para uma ação, com cada item clicável para o aluno **e** para a turma |
| `/agenda` | `agenda-view` + `agenda-dia-dialog` | mês inteiro; clique no dia abre o detalhe operável |
| `/pessoas/alunos` (+ `novo`, `convite`, `[id]`) | `students-list`, `create-student-form`, `convite-form`, `edit-student-form`, `frequencia-aluno` | alunos, fila de aprovação, convite, senha temporária, e a frequência do aluno (**SPEC-015**: agregado + quebra por turma, nunca um sem o outro) |
| `/pessoas/professores` (+ `novo`, `[id]`) | `teachers-*` | professores (cadastro sem login — ver Gaps) |
| `/pessoas/niveis` | `levels-manager` | níveis |
| `/quadras` (+ `novo`, `[id]`) | `courts-list`, `court-manager`, `horario-quadra-section` | quadras, disponibilidade, reserva, horário próprio |
| `/turmas` (+ `novo`, `[id]`) | `classes-list`, `class-manager`, `turma-chamada-abas` → `presencas-turma` \| `frequencia-turma` | turmas e alocação; presença e frequência são **abas uma da outra** (**SPEC-015**), porque são duas leituras do mesmo dado — "Presenças" primeiro, que é o registro; "Frequência" depois, que é a interpretação dele |
| `/pagamentos` | `payment-config-form` | meio de pagamento e confirmação |
| `/configuracoes` | `configuracoes-view` + `link-cadastro-card` | horário padrão da empresa e, desde a **DEF-003**, o link de auto-cadastro pronto para copiar (`GET /me/company`) — o `slug` existia desde a SPEC-009 e não chegava a tela nenhuma. **DEF-004:** o mesmo card liga e desliga o auto-cadastro (`PATCH /me/company`), cumprindo o REQ-006 da SPEC-009, que era lido em dois lugares e escrito em nenhum |

**`frequenciaPct` chega `null` do servidor em dois casos** — sem registro no
período, ou cobertura de chamada abaixo do piso — e a tela mostra `—` com
explicação, **nunca `0%`**. Zero por cento acusaria o aluno por chamada que
o professor não lançou.

## 4. Estado

| Tipo | Onde vive |
|---|---|
| Server state | `useState` + `useEffect` por tela, via `lib/api-client.ts` |
| Sessão | `lib/auth-storage.ts` — access token em `localStorage`; refresh em cookie `httpOnly` |
| UI local | `useState` no componente |
| Global | **não existe** |

**Nada de global.** Não há Zustand, Redux, Jotai nem Context de estado —
verificado por busca no código. Cada tela busca o que precisa no `useEffect`
e guarda em `useState` local. É adequado ao tamanho atual e é o principal
candidato a virar problema quando duas telas precisarem do mesmo dado
fresco ao mesmo tempo (ver Gaps).

## 5. Camada de API — a regra que mais importa

Todo acesso autenticado passa por **`authFetch`** (`lib/api-client.ts`), que
concentra três comportamentos:

1. **anexa o access token** do `localStorage`;
2. **renova a sessão em `401`** chamando `/auth/refresh` com
   `credentials: "include"`, e repete a requisição uma vez. A renovação é
   **compartilhada** entre chamadas simultâneas: sem isso, três `401` ao
   mesmo tempo disparariam três refreshes, e a rotação do backend trataria
   os concorrentes como reuso de token, **revogando a sessão inteira**;
3. **desvia em `403 SENHA_TEMPORARIA`** para a tela de primeiro acesso
   (só no `cliente`), em vez de mostrar erro seco.

**Chamar `fetch` direto numa tela é violação de camada** — perde as três
coisas acima.

## 6. Tipos do contrato

`lib/api-types.ts` é **gerado** do `openapi.json` do `back`
(`pnpm run gen:api-types`). Não editar à mão.

**Gap conhecido:** o CI **não** valida se esse arquivo está atualizado — a
mitigação é lembrar de rodar o comando, que é o tipo de mitigação que falha
em silêncio. Ver Gaps.

## 7. Requisitos de plataforma

Web responsivo, português do Brasil, tema claro. Sem offline (o service
worker do `cliente` registra, mas não há estratégia de cache de dados).
Deploy: Netlify (plano Personal desde 2026-08-22, ADR-014).

## 8. Regras de camada (com gate)

| Regra | Gate |
|---|---|
| `page.tsx` fina; lógica em componente cliente | revisão |
| Todo acesso autenticado por `authFetch` | busca por `fetch(` fora de `lib/` — **0 violações em 2026-08-22** |
| Presença é só leitura no Admin | não existe função de escrita de presença em `api-client.ts` (LIM-002) |
| `api-types.ts` nunca editado à mão | arquivo é gerado; diff denuncia |
| Sem estado global sem ADR | busca por libs de estado no CI seria o gate — **hoje não existe** |
| `typecheck`, `lint`, `test`, `build` verdes | CI (GitHub Actions) a cada push |
| `comprimir-imagem.ts` idêntico entre `admin` e `cliente` | **não existe gate** — poly-repo sem pacote compartilhado (ADR-001). Custo declarado, ver a seção da compressão |

## 9. Compressão de imagem no navegador (SPEC-018/TASK-002)

`lib/comprimir-imagem.ts` — **existe desde 2026-08-25 e ainda não tem
chamador**: as telas que sobem foto são das TASK-003 a 006. É a peça que
transforma a foto de 12 MP do celular no que o servidor aceita: **2000px no
maior lado, WebP q90** (REQ-001), abaixo do teto de 2 MB e dos 2500px que o
`back` impõe.

**O arquivo é duplicado, byte a byte, em `admin` e `cliente`** — poly-repo
(ADR-001), sem pacote compartilhado. **Não há gate que garanta a
sincronia**: as duas cópias divergirem em silêncio é o custo declarado da
decisão, e mudança numa é mudança na outra.

**A parte que não é óbvia é `sRGB` (INV-050).** `canvas.toBlob('image/webp')`
num aparelho de tela **Display P3** pode gravar o chunk `ICCP`, e o validador
do `back` é allowlist — recusa. O defeito só apareceria no aparelho de quem
está usando, que é o pior lugar para ele morar. Duas defesas:

1. `getContext('2d', { colorSpace: 'srgb' })` e
   `createImageBitmap(f, { colorSpaceConversion: 'default' })`, os dois
   **explícitos**;
2. `inspecionarWebp()` lê os FourCC do resultado **antes de subir**, e
   reprova localmente com mensagem legível em vez de deixar virar 422.

A defesa 2 **não é uma segunda validação**: a autoridade continua sendo
`webp.validator.ts` no `back`, que confere ordem, cardinalidade e dimensão.
Aqui só se pergunta "apareceu chunk que eu sei que vai ser recusado?".

**O que os testes provam e o que não provam.** `jsdom` não tem canvas nem
encoder de WebP, então **nenhum teste comprime imagem de verdade** — a
costura `DependenciasDoNavegador` existe para isso, e adicionar o pacote
nativo `canvas` seria mudar a lista de dependências deste repositório por
causa de um teste. Provado: a conta de dimensão (varredura, não caso
escolhido), a leitura de chunk, e **os argumentos exatos** de
`getContext`/`createImageBitmap`/`toBlob`. **Não provado, e é lacuna real:**
que um Chrome em tela Display P3 de fato não grava `ICCP` — isso é prova de
aparelho, e a defesa contra ela estar errada é a inspeção do resultado.

### Por que NÃO há foto de perfil neste painel

A tela `/perfil` existiu aqui por algumas horas em 2026-08-25 e **foi
removida no mesmo dia**. O motivo fica registrado porque a armadilha é fácil
de repetir: a tabela de atores da SPEC-018 dá foto de perfil a **`aluno` e
`professor`, e só**; ao `company_admin` ela dá imagem de quadra, logo e foto
de professor sem conta. A linha de contrato dizia `PUT /api/v1/me/foto` para
*"qualquer autenticado"*, e foi essa frase — genérica, não decisão — que
produziu a tela.

**A rota continua existindo no `back` e continua correta**: um
`company_admin` que a chamasse gravaria a própria foto. O que não existe é
tela para isso aqui, e é deliberado.

**Foto de gestor não é logo da empresa**, e confundir as duas é o risco real:
a foto de pessoa é `usuarios.foto_key`, **privada**, URL assinada que expira;
a logo é `empresas.logo_key`, **pública** e permanente (TASK-006). Colunas
diferentes, prefixos de chave diferentes, regimes de acesso diferentes.

`lib/comprimir-imagem.ts` **fica**: é a TASK-006 que vai usá-la, e a
correção do `Content-Type` em `authFetch` também — `FormData` nunca leva
cabeçalho nosso, porque quem conhece o `boundary` é o navegador.

## 10. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | **`api-types.ts` pode ficar stale**: o CI não compara com o `openapi.json` do `back`. Já aconteceu — o `sadmin` acumulou 1.461 linhas de diferença | Média |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
| 5 | Ícones e paleta ainda derivados de inferência, sem arquivo de marca oficial | Baixa |
