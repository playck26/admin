# ARCHITECTURE — `admin` (PlayCK)

**Fonte: análise direta do código.** Data: **2026-09-26** (era 2026-09-25).
**Conferido por comando em 2026-09-26:** **57 arquivos de teste, 538 casos**
(`vitest run --pool=threads`, sozinho e em série). *A SPEC-075/TASK-005 somou
`levels-manager.test.tsx` (10 casos); a ADR-027 somou
`turmas-aula-lotada.test.tsx` (5) e 2 casos no `aula-da-turma-dialog.test.tsx`,
um módulo (`lib/aula-lotada.ts`) e **nenhum componente**. Os números do bloco
abaixo (50/448/72) são de 2026-09-17 e ficaram para trás — a contagem desta
linha é a vigente.*

**A tela do gestor não anuncia a vaga que a alocação recusa (ADR-027).** A
alocação passou a exigir que o aluno caiba em todas as próximas aulas, contando
as reposições (`409 AULA_LOTADA`). A lista e o detalhe da turma trazem
`proximaAulaLotada`: `/turmas` escreve "Lotada em dd/mm" ao lado de "3/8", e a
página da turma e o diálogo da aula (agenda) avisam antes de alocar — **sem
bloquear**, porque quem já é visitante daquela aula ainda cabe, e só o servidor
sabe disso. O texto mora em `lib/aula-lotada.ts` (data por fatia, nunca `new
Date`, que em UTC−3 volta um dia). **E o diálogo da aula deixou de engolir o
dia:** ele trocava todo `409` ao alocar pelo texto de "vaga de matrícula"; o
`AULA_LOTADA` agora passa a mensagem do servidor inteira.

**`/pessoas/niveis` edita nível (SPEC-075/D8).** Antes só criava e apagava; o
`updateLevel` existia no `api-client` sem tela. Agora cada linha tem **Editar**
(nome e ordem, `PATCH /levels/:id`), e a recusa do servidor aparece inteira —
inclusive a `422 NIVEL_INCOMPATIVEL_COM_MATRICULAS` de uma reordenação que
deixaria aluno sem nível fora do nível de uma turma. **E a tela diz qual é o
primeiro nível** e que ele vale para quem ainda não foi classificado — pelo
mesmo desempate do servidor (`ordem`, `createdAt`, `id`), em `primeiroNivel`,
que só escreve a frase: **quem decide o acesso é o Back** (ADR-026). As recusas
de nível das outras telas (alocar aluno, editar aluno, editar turma) já
chegavam pela `ApiError.message` e não pediram mudança.

**Conferido por comando nesta data, com a SPEC-057/TASK-005 empilhada sobre a
TASK-004:** 50 arquivos de teste, 448 casos, **72 componentes**
(`vitest run --pool=threads`; `.tsx` de `src/components`, sem subpastas e sem os
`.test.tsx`). *A TASK-005 soma quatro componentes — `bloco-da-agenda`,
`legenda-da-agenda`, `aula-da-turma-dialog` e `seletor-de-cor-da-quadra` — e
sete arquivos de teste (seis de componente e `lib/visual-da-agenda.test.ts`).*
*Registro de 2026-09-15:* 43 arquivos de teste, 400 casos, 68
componentes (mesmo comando). *A SPEC-049 soma dois arquivos de teste e um
componente (`seletor-de-aluno`). A SPEC-054 soma sete arquivos de teste e cinco
componentes — `adicionais-manager`, `tipos-de-adicional-manager`,
`nomes-de-tipo-card`, `seletor-de-adicionais` e `itens-da-reserva`; mais um de
teste (`scripts/netlify-ignore.test.mjs`, 32 casos) com a regra de deploy. A linha de
2026-09-14 dizia 33/315/62. A de 2026-09-11 dizia 27/238/58 e já estava atrás do código — a SPEC-050 registrou
30/306. A SPEC-052 soma um arquivo de teste e nenhum componente (31/308/61); a
SPEC-053 soma dois arquivos de teste e um componente (`reservas-hub`).* Registro de
2026-09-11: *O número de componentes **não mudou na SPEC-047**, e isso é a
decisão: o preço da aula entrou como campo em `edit-teacher-form` e em
`prazos-de-cancelamento-card`, não como cartão próprio — ver o `/configuracoes`
abaixo, onde está o porquê. Não tinha mudado no DEF-027 pela mesma razão:
entrou um bloco dentro de `edit-student-form`, e desligar aluno é ação da
ficha.*

Planta **AS-IS**. Intenção arquitetural vive em `TARGET_ARCHITECTURE.md`
(raiz do workspace) + ADRs em `DECISIONS.md`. Divergência entre este
documento e o código é defeito **deste documento**.

**Quem usa:** `company_admin` — o dono/gestor da escola ou arena · **Produção:** `admin.playck.com.br`

Painel de operação: pessoas, reservas (quadras e seus catálogos), turmas,
pagamentos, horário de funcionamento e a agenda mensal. É a tela onde a escola trabalha todo dia.

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
| `/dashboard` | `dashboard-summary` + `evasao-card` + **`vencimentos-card`** | **SPEC-052: o bloco "Acesso rápido" saiu** — repetia o menu lateral item por item, e agora tem prova de ausência (`dashboard-summary.test.tsx`). 3 KPIs do período e, desde a **SPEC-015**, o cartão "alunos em risco" — a única tela do Admin que puxa para uma ação, com cada item clicável para o aluno **e** para a turma. **SPEC-045:** entra o de **vencimento de matrícula**, e agora são duas telas que puxam para ação. Dois grupos separados — vencidas antes de vencendo, porque quem já venceu está sem plano vigente *agora* — e a janela (7/30/60) é escolha do gestor, ecoada pelo servidor. **A rota `/dashboard` da API continua com três números**: o card chama `/matriculas/vencimentos` por conta própria, porque a tela pode juntar o que a API mantém separado e o contrário faria a resposta do painel crescer com o clube |
| `/agenda` | `agenda-view` + `agenda-dia-dialog` + **`agenda-semana`** + **`agenda-semana-acoes`** | **duas abas.** *Mês*: o mês inteiro, e clique no dia abre o detalhe operável. *Semana* (**SPEC-034**): uma grade dia × hora — o mês já mostra volume, e quem abre a semana quer ver **onde** estão os buracos; sem as horas não haveria como clicar num vão para criar nem julgar se mover faz sentido. A faixa de horas sai **dos itens**, não de constante: um clube que abre às 6h não pode ter reserva escondida fora da janela. Três ações saem da grade — criar no vão, **mover** reserva avulsa e **cancelar uma ocorrência** de turma. O filtro de quadra casa por **`quadraId`, nunca por nome**: `quadras.nome` não é único no banco, e a validação cruzada de 2026-09-05 reproduziu o efeito — escolher a quadra A mostrava reserva da B homônima. **SPEC-032:** cada item mostra quem criou e quem cancelou — e quando não há evento diz *"sem histórico registrado"*, nunca "criada por —". Não é caso de borda: é o estado normal de quase toda linha no dia do deploy (LIM-032a), porque as ocupações anteriores à spec nasceram sem evento. **SPEC-054:** a "Nova reserva" da semana leva o `seletor-de-adicionais` (mover e cancelar aula não — mover não muda valor nem itens), e o diálogo do dia lista os itens de cada reserva **SPEC-057/TASK-005 (card 5349):** a cor da grade deixou de significar tipo/status — os três tokens mediam 1,04:1 entre si (SPEC-052/D3) — e passou a ser da **quadra**, num marcador de 4 px `aria-hidden`. `bloco-da-agenda` tem substrato **branco opaco e texto `#12160F` fixos** em todo tema e estado, **sem `opacity`** (misturaria o fundo e derrubaria o contraste medido), sem `truncate` (nome longo quebra linha; o `Q-<código>` e o estado nunca somem) e alvo `min-h-11`; tipo e estado viram **ícone, borda e rótulo** (pendente tracejado; cancelada tem precedência). A regra mora em `lib/visual-da-agenda.ts`, e `legenda-da-agenda` — **fora da grade**, porque a grade rola na horizontal a 320 px — aplica os mesmos mapas: tipos, estados e cada quadra por **nome + Q-código + nome da cor**. Fecha a LIM-052c. O filtro de quadra passa a escrever o código (homônimas deixam de ser opções iguais). **Clicar numa aula de turma abre `aula-da-turma-dialog`**, e não mais o cancelamento: "Matrículas X/Y" e "Ocupação desta aula X/Y" separadas (vaga de reposição não é vaga de matrícula), matriculados com *Remover*, `seletor-de-aluno` para alocar e os **visitantes de reposição** (nome e nível, pela rota `/agenda/ocorrencias/:id/visitantes`, carregada ao abrir). Ações pelos endpoints de matrícula que já existiam; **erro não fecha o diálogo nem tira a linha** (sem remoção otimista), e o `409` de capacidade explica a diferença entre as duas vagas. "Cancelar esta aula" sai de dentro dele. No diálogo do dia (aba Mês) a linha de turma ganha **"Alunos da aula"** e continua sem "Marcar pago" e "Cancelar" (SPEC-012/AC-007) |
| `/pessoas/alunos` (+ `novo`, `convite`, `[id]`) | `students-list`, `create-student-form`, `convite-form`, `edit-student-form`, `frequencia-aluno`, **`carteira-do-aluno`** | alunos, fila de aprovação, convite, senha temporária, e a frequência do aluno (**SPEC-015**: agregado + quebra por turma, nunca um sem o outro). **SPEC-033:** a **carteira** entra na mesma ficha, pelo mesmo motivo da frequência — quem lança crédito está olhando para uma pessoa, não para uma carteira. Ela é a **única tela do Admin que pede senha para agir** (D6), e pede a **cada** lançamento: não há sessão elevada, e o campo é limpo depois do envio inclusive quando dá certo. O erro vai para o campo certo pelo **`code`** da resposta, nunca por texto — `SENHA_INVALIDA` é da senha, `SALDO_INSUFICIENTE` é do valor —, e errar a senha **não apaga** o que já foi digitado **SPEC-036:** logo abaixo entra `cadastro-completo-do-aluno` — sete campos que faltavam (nascimento, contato de emergência, endereço) e a **barra que mostra o que falta**, não só o número. `70%` não diz a ninguém o que fazer. **Campo vazio vira `null`, nunca `""`**: o servidor recusa string vazia com `400` (INV-108), e uma tela que a mandasse transformaria "apagar" num erro sem explicação. A lista de UFs tem o **tipo vindo do contrato** (`UpdateStudentDto["uf"]`), não de um `string[]` solto — que deixaria o typecheck verde e a tela oferecendo uma sigla que o servidor recusa **SPEC-037:** e a **matrícula** fecha a ficha, depois da carteira — as duas são dinheiro, e a ordem é de frequência: crédito se lança toda semana, matrícula uma vez por contrato. **Valor em branco vira `undefined`, nunca `0`**: zero é bolsa integral, um valor legítimo, e `Number("")` daria o plano de graça sem ninguém perceber. As três recusas viram mensagens com saídas DIFERENTES — `CONTRATO_NAO_ACEITO` pede ao aluno, `CONTRATO_NAO_PUBLICADO` pede ao gestor, `PLANO_INATIVO` pede outro plano **SPEC-038:** abaixo da lista entra `importar-alunos` — subir CSV, **conferir** e importar. A conferência é o que torna aceitável o tudo-ou-nada da escrita: o gestor vê o estrago antes de causá-lo, e "Importar" só libera depois de um relatório sem erros. **Trocar o arquivo apaga o relatório do anterior** — sem isso ele importaria um arquivo tendo conferido outro. As senhas temporárias aparecem **uma única vez**, com o aviso ACIMA da lista: depois de fechar a página é tarde, porque nenhuma rota as devolve. Fica na mesma página e não como item de menu: quem sobe planilha está olhando para os alunos que já existem, e é olhando para eles que percebe que faltam trezentos **DEF-027:** e no fim da ficha entra **"Situação no clube"** — desligar e reativar o aluno. Existia para turma, quadra, professor e plano, e **não para aluno**, que é justamente o gesto que o back manda usar quando se tenta recusar o vínculo de alguém já aprovado. A recusa `409 ALUNO_COM_COMPROMISSOS` vai para a tela **inteira**, com a contagem: "não foi possível desligar" faria o gestor procurar na agenda dia a dia sem saber se procura uma reserva ou trinta |
| `/pessoas/professores` (+ `novo`, `[id]`) | `teachers-*`, `foto-do-professor`, **`disponibilidade-do-professor`**, **`marcar-aula-particular`** | professores (cadastro sem login — ver Gaps). **SPEC-040:** a **grade da semana** entra na ficha, pelo mesmo motivo da carteira do aluno — quem configura agenda está olhando para uma pessoa. Ela é a única tela do painel cujo `GET` e `PUT` têm **formas diferentes de propósito**: o `GET` devolve os sete dias (com `indisponivel` calculado nos vazios) para a tela não precisar saber que ausência significa algo; o `PUT` manda **só os dias atendidos**, porque não existe flag no modelo (D6). Desmarcar um dia o faz **sumir** do corpo, e há teste só para isso. **SPEC-039:** logo abaixo dela entra `marcar-aula-particular`, e a ordem é a decisão — o gestor configura quando o professor atende e, na mesma tela, marca dentro dessa janela. *A tela da quadra já marcava aula e **ninguém achava**: lá o seletor de professor vive dentro do formulário de reserva, que só nasce depois de escolher a data, pedir a disponibilidade e clicar num horário. Feature que existe e não é alcançável é feature que não existe — e quem descobriu foi o Israel, abrindo o Admin e não encontrando.* O ganho desta tela é **avisar antes de enviar**: ela mostra a janela do dia escolhido e limita as horas oferecidas. Guia, não garante — a leitura não desconta aulas já marcadas (LIM-039e). **SPEC-047:** a ficha ganha o **preço da aula particular** deste professor, e o campo é um campo, não um cartão. **Vazio não é grátis: é "usa o padrão do clube"**, e a frase embaixo dele diz isso na tela — sem ela o gestor deixaria em branco achando que o professor não dá aula particular, e ele daria, pelo padrão. Sem preço aqui nem no clube, o professor **não aparece** para o aluno marcar: a ausência é a configuração. Vazio grava `null` (apaga e volta a herdar), nunca `undefined` (não mexe) — são duas intenções diferentes, a lição dos sete campos da SPEC-036. **SPEC-054:** `marcar-aula-particular` ganha o `seletor-de-adicionais` depois do horário; o `valor` enviado continua sendo o da **aula** (quem soma é o servidor, D6), e o saldo anunciado usa aula + adicionais (AC-013) |
| `/pessoas/niveis` | `levels-manager` | níveis |
| `/reservas` | `reservas-hub` | **SPEC-053/D6 — o item "Reservas" do menu, no lugar de "Quadras" e "Esportes e pisos".** Quadra virou um *tipo* de reserva (ADR-021), e o menu que oferecesse os dois itens soltos continuaria vendendo as peças como se fossem a área. A página é **só um índice**: dois cartões, **Quadras** (com "N ativas") → `/quadras` e **Esportes e pisos** → `/quadras/catalogos`. **As rotas de quadra não mudaram de endereço** (categoria C da D1) — mover `/quadras/*` quebraria favorito e link sem ganho para quem usa. A contagem vem de `listCourts`, e **a falha dela não derruba os cartões**: o índice é o caminho para as telas, e um número que não carregou não pode fechar a porta. **SPEC-054/D12:** mais dois cartões, **Adicionais** → `/reservas/adicionais` e **Tipos de adicional** → `/reservas/tipos`, e o `nomes-de-tipo-card` na própria página — os nomes que o aluno lê para Quadra e Aula particular. **Campo vazio é o nome padrão e vai como `null`**, com o padrão como `placeholder`: gravar "Quadra" como texto faria o clube perder o padrão sem perceber. Os **dois** campos vão sempre no corpo, que é o que o servidor exige |
| `/reservas/adicionais` | `adicionais-manager` | **SPEC-054/D12 e D13** — o que o clube aluga junto com a reserva: tipo, nome, preço e estoque. **Não há botão de apagar**: tirar de oferta é *Desativar*, porque o item de uma reserva aponta para o adicional. **Baixar o estoque abaixo do reservado é permitido** (uma raquete quebrou) — as reservas feitas não mudam, e depois de salvar a tela lista os horários que ficaram acima (`horariosAcimaDoEstoque`), para o gestor decidir o que fazer com eles. A edição manda **só** `tipoId`, `preco` e `estoque` — o nome não viaja se não foi mexido |
| `/reservas/tipos` | `tipos-de-adicional-manager` | **SPEC-054/D12** — o catálogo livre que agrupa os adicionais (Raquetes, Bolas). Criar vai para o fim da ordem; renomear e apagar. **`422 TIPO_EM_USO` é informação**: a mensagem do servidor diz quantos adicionais usam o tipo e é exibida como veio |
| `/quadras` (+ `novo`, `[id]`, **`catalogos`**) | `courts-list`, `court-manager`, `imagem-da-quadra-section`, `horario-quadra-section`, **`catalogo-de-quadra-manager`**, **`seletor-de-catalogo`** | **alcançadas pelo cartão de `/reservas` desde a SPEC-053**, sem item próprio no menu — e "Reservas" acende em todas elas. O único texto que mudou aqui foi o do seletor de professor: *"Sem professor"*. Quadras, disponibilidade, reserva, horário próprio e, desde a **SPEC-018/TASK-005**, a imagem da quadra com a confirmação obrigatória. **SPEC-039:** a mesma grade marca **aula particular** — escolher um professor no formulário é o gesto que transforma a reserva em aula e revela o campo de preço; só professores **ativos** entram no seletor, porque o servidor recusa o inativo com `422` e oferecer quem vai ser recusado é fazer o gestor descobrir por erro. **`professorId` e `valor` viajam juntos ou nenhum viaja** **SPEC-054:** o formulário de reserva ganha o `seletor-de-adicionais`, e o total e o débito anunciado passam a somar **blocos × adicionais** — ver a seção do seletor. O horário reservado mostra os itens (`2× Raquete`) **SPEC-057/TASK-005/D19:** `seletor-de-cor-da-quadra` na ficha e na criação — seis amostras rotuladas em rádios nativos, sem cor livre nem transparência; na criação, sem escolha o campo vai **ausente** e o banco usa o padrão. A ficha mostra o código (`Q-<código>`, gerado pelo banco e não editável) e a lista escreve nome + código |
| `/turmas` (+ `novo`, `[id]`) | `classes-list`, `class-manager`, `turma-chamada-abas` → `presencas-turma` \| `frequencia-turma` | turmas e alocação; presença e frequência são **abas uma da outra** (**SPEC-015**), porque são duas leituras do mesmo dado — "Presenças" primeiro, que é o registro; "Frequência" depois, que é a interpretação dele. **SPEC-030 deu a esta tela a primeira ação de ESCRITA** — até então era só leitura (LIM-002): o grupo **"Aulas sem chamada"** lista as ocorrências `pendente` e oferece registrar que a aula não aconteceu. Elas **não apareciam aqui**, porque a tela sempre filtrou por `chamadaFeita`; enquanto o professor está no clube isso é coerente (quem lança é ele), mas quando ele sai ninguém mais tem caminho e o dia fica vermelho para sempre no calendário dele. O texto diz de quem é a ação **antes** de oferecer a saída. **SPEC-035:** o botão "Inativar turma" existia desde a SPEC-008 e **não fazia nada além de gravar a coluna** — a quadra ficava bloqueada para sempre, apontando para uma turma fora de operação (medido, não deduzido). Agora inativar libera a grade futura e reativar a regenera, e a recusa por conflito é traduzida **com a contagem**: a mensagem crua do servidor não diz se é um horário ou seis, e é isso que muda o que o gestor faz a seguir. Abaixo do botão entra `aulas-canceladas-da-turma` — **a porta da reativação de uma aula**, porque a agenda esconde o cancelado e ninguém reativa o que não vê. É a mesma lição que a SPEC-039 pagou na tela, aplicada antes de doer |
| `/pagamentos` | `payment-config-form` | meio de pagamento e confirmação |
| `/configuracoes` | `configuracoes-view` + `link-cadastro-card` + `limite-de-turmas-card` + `contrato-do-clube-card` | horário padrão da empresa e, desde a **DEF-003**, o link de auto-cadastro pronto para copiar (`GET /me/company`) — o `slug` existia desde a SPEC-009 e não chegava a tela nenhuma. **DEF-004:** o mesmo card liga e desliga o auto-cadastro (`PATCH /me/company`), cumprindo o REQ-006 da SPEC-009, que era lido em dois lugares e escrito em nenhum. **SPEC-023:** o `limite-de-turmas-card` entrou logo abaixo — os dois decidem até onde vai o "sozinho" do aluno, um controlando quem entra no clube e o outro em quantas turmas. Campo vazio = sem limite, que é o padrão; a tela avisa que o limite **não expulsa ninguém** (INV-023a), porque quem configura precisa saber o que NÃO vai acontecer. **SPEC-024:** o `contrato-do-clube-card` escreve e publica o contrato — e publicar exige um passo de confirmação que mostra **quantas pessoas terão que reaceitar**, com o número na frente. Botão "Publicar" sem esse aviso parece salvar rascunho, e não é: interrompe cada aluno no próximo acesso. Também avisa que **não existe despublicar** (LIM-024a) **SPEC-047:** o **preço padrão da aula particular** entra no `prazos-de-cancelamento-card`, e **não num cartão próprio** — os dois escrevem o mesmo recurso (`PUT /me/company/config-operacao`), que é **substituição total**. Dois cartões seriam dois lugares que precisam lembrar um do outro, e o primeiro a esquecer apagaria o campo do outro. **Isso quase aconteceu, e foi o `tsc` que pegou**: com o campo novo no tipo gerado, o typecheck reprovou o card que mandava só os dois prazos — e o que ele estava dizendo é que salvar um prazo APAGARIA o preço do clube, sem erro nenhum na tela. O gestor descobriria pelos alunos sumindo da tela de aula particular, dias depois. Campo vazio grava `null`, que aqui significa *"o clube não vende aula particular"* — nunca `undefined`, que não mexeria. **SPEC-037:** o `planos-card` entra logo abaixo do contrato, e a ordem é a decisão — matricular exige contrato publicado (`422 CONTRATO_NAO_PUBLICADO`), então quem chega para criar plano vê antes o que precisa existir primeiro. **Não há botão de apagar plano**: contratado, ele carrega história e a FK `RESTRICT` recusaria com `23503`; "Desativar" é a única forma, e nunca perde dado. O cartão mostra `link do clube` × `link próprio`, porque sem isso o gestor não distinguiria um plano configurado de um que só segue o padrão — e mudar o link da empresa alteraria, em silêncio, planos que ele achava próprios |

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

**PWA (SPEC-050) — passou a existir neste ciclo.** A ADR-012 sempre disse que
`cliente` **e `admin` (e `sadmin`)** seriam PWA instalável, e por mais de um mês
só o `cliente` era: `admin.playck.com.br/manifest.webmanifest` respondia **404**, sem
service worker e sem ícone de instalação. Não era decisão revista — era ADR
descumprida, e ninguém tinha rodado o `curl`.

Agora há `app/manifest.ts`, `public/sw.js`, `register-service-worker.tsx` e
`convite-de-instalacao.tsx`, com a decisão em `lib/instalacao-pwa.ts`. **O
`sw.js` recebe push desde a SPEC-062** — ver a seção 10. Três
pontos não óbvios, cada um com teste:

1. **O evento é capturado antes da hidratação** — um `<Script
   strategy="beforeInteractive">` no `layout.tsx` guarda o
   `beforeinstallprompt`, porque o Chrome o dispara logo após o `load`,
   normalmente antes de um `useEffect` assinar.
2. **Dois modos** — `botao` no Chromium (diálogo nativo) e `instrucao` no iOS,
   onde o evento não existe. A detecção testa `Macintosh` + `maxTouchPoints > 1`,
   porque o iPad se anuncia como Mac desde o iPadOS 13.
3. **Dispensar vale 15 dias** (`playck_instalacao_dispensada_em`), e a chave
   **não** leva o prefixo `playck_admin_` de propósito: aquelas saem no
   `clearAccessToken()`, e dispensa que morre no logout faz o convite voltar a
   cada sessão.

**Sem `orientation` no manifest**, ao contrário do `cliente` (que trava em
`portrait`): este painel é usado no celular na beira da quadra **e** no desktop, e
travar orientação quebraria o uso de mesa, onde a agenda e as tabelas precisam
de largura.

**Os ícones são gerados, não editados** — `harness/pwa/gerar-icones.mjs` (raiz
da governança) refaz os 15 arquivos dos 3 apps a partir de
`public/playck-logo.png`, achatando o alfa e gerando o par `maskable`. Os
ícones antigos deste repo eram o logo **com canal alfa**: fundo preto no iOS.

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

**E até 2026-08-26 isso não bastava**, porque `api-client.ts` declarava por
cima tipos escritos à mão para as **respostas** — que não existiam no
`openapi.json`. `Court.esporte` era tipado como a linha inteira do catálogo,
com `ordem` e `createdAt`, quando a API embute só `{ id, nome }`: ninguém
quebrou, mas ler `quadra.esporte.ordem` daria `undefined` com o typecheck
concordando. **É o DEF-012 na direção oposta** — lá o tipo negava o objeto,
aqui prometia campos que não chegam.

Desde a SPEC-020/TASK-007, `Court` e as opções de catálogo vêm do
`openapi.json`. **`pnpm run api-types:check`** diz em um comando se o
arquivo gerado está em dia.

> **O gerador expõe defeito de contrato, e isso aconteceu na SPEC-033.**
> `@ApiProperty({ nullable: true })` **sem `type`** no back produz schema sem
> tipo, e o `openapi-typescript` gera `Record<string, never>`: o campo compila
> lá, aparece no `openapi.json` e fica **inutilizável aqui**. Achado tentando
> renderizar `motivo` no extrato, e consertado **na origem** (`back#68`) — não
> com um cast local, que esconderia exatamente o que este gerador existe para
> revelar.

**`ApiError` carrega o `code` desde a SPEC-033.** A mensagem é para a pessoa; o
código é para a tela decidir **onde** mostrar o erro. Casar texto para isso
seria o mesmo retrocesso que o back recusou no contrato de erro das triggers.

**O gap fechou na SPEC-067 (2026-09-22).** O job **`contrato`** do CI compara
este arquivo com o contrato do `back` **fixado por SHA** em
`src/lib/contrato.lock.json`, buscado por `raw` imutável — em poly-repo não há
`../Back` no checkout (ADR-001). Ele gera num temporário e **não escreve** no
repositório, e o passo exige a linha `OK ... em dia`, não só o exit 0: um
script vazio também sai 0, e isso aconteceu ao replicar o gate.

Duas perguntas, dois mecanismos. O job responde *"os tipos correspondem ao
contrato fixado?"* e **reprova a PR**. O `contrato.yml` agendado responde *"o
contrato fixado ainda é o atual?"* e **abre uma PR-espelho** (`contrato/sync`)
em vez de reprovar PR alheia — 82 dos 277 commits do `back` em 30 dias mexeram
no contrato.

**Ressalva:** até o ruleset exigir `contrato` (SPEC-067/TASK-004, passo de
painel), o job aparece na PR mas **não bloqueia** o merge.

**E em 2026-09-05 o mecanismo que EXISTE mostrou o valor dele.** A SPEC-034
acrescentou `quadraId` ao `ItemDaAgendaResponseDto`, e o `typecheck` ficou
vermelho sozinho nas cinco fixtures de `agenda-view.test.tsx` — porque elas
são **tipadas**, e não `unknown[]`. É exatamente a INV-059 (SPEC-021) fazendo
o trabalho: a fixture é o lugar onde a mudança de contrato dói primeiro. O que
continua sem gate é o outro sentido — campo novo que **ninguém consome** passa
despercebido, e foi por isso que o `quadraId` precisou de um defeito
reproduzido para nascer.

**O "sentido que continua sem gate" fechou junto.** Um campo novo que ninguém
consome passava despercebido pelo `typecheck` — e é exatamente o caso que o job
`contrato` pega: a sabotagem da SPEC-067/AC-001 inventou um campo opcional à
mão no tipo gerado, o `typecheck` saiu **0** e o `contrato` saiu **1**, no
mesmo run de CI.

## 7. Requisitos de plataforma

Web responsivo, português do Brasil, tema claro. Sem offline (o service
worker do `cliente` registra, mas não há estratégia de cache de dados).
Deploy: Netlify (plano Personal desde 2026-08-22, ADR-014).

**Build pulado quando o commit não muda o site (2026-09-15).** Cada deploy de
produção custa **15 créditos**, qualquer que seja o tamanho do commit; entre 8 e
15/09, 26 merges nos três frontends gastaram ~351 dos 500. O `netlify.toml` chama
`scripts/netlify-ignore.mjs`, que **cancela o build (exit 0) só se todo arquivo
mudado** for documentação fora de `public/`, teste, `src/lib/api-types.ts` (só
tipos), o `src/lib/contrato.lock.json` (SPEC-067), CI, lint ou a própria regra. Sem os dois commits, com o mesmo commit
(*Trigger deploy* manual) ou com o `git diff` falhando, **constrói**. Aplicado ao
histórico real da semana, pula exatamente os 6 deploys que não mudavam o site e
constrói os outros 20. **O arquivo é idêntico nos três frontends**, sem gate de
sincronia (ADR-001). Mudou o `netlify.toml` ou uma variável no painel? *Trigger
deploy*.

## 8. Regras de camada (com gate)

| Regra | Gate |
|---|---|
| `page.tsx` fina; lógica em componente cliente | revisão |
| Todo acesso autenticado por `authFetch` | busca por `fetch(` fora de `lib/` — **0 violações em 2026-08-22** |
| Presença é só leitura no Admin | não existe função de escrita de presença em `api-client.ts` (LIM-002) |
| `api-types.ts` nunca editado à mão, e em dia com o contrato fixado | job **`contrato`** do CI (SPEC-067): regenera do `back@<sha>` do `contrato.lock.json` e compara — reprova a PR. Obrigatório só depois da TASK-004 |
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

**A parte que não é óbvia é o `ICCP` (INV-050, reescrita em 2026-08-26).**
`canvas.toBlob('image/webp')` **sempre** grava o chunk `ICCP` com um perfil
sRGB de 456 bytes, e o validador do `back` é allowlist — recusa. Sem
tratamento, **nenhuma imagem sobe**.

**O que este parágrafo dizia antes estava errado, e custou o DEF-010.** Dizia
que era caso de aparelho **Display P3** e que forçar `sRGB` no canvas
evitaria o chunk. Medido em Chrome 151 headless, sem tela nenhuma:
`colorSpace: 'srgb'`, contexto sem `colorSpace`, `colorSpaceConversion:
'none'` e `OffscreenCanvas` produzem o **mesmo arquivo, byte a byte**, todos
com `ICCP`. Foto de perfil e logo ficaram no ar sem funcionar.

Três camadas hoje:

1. `getContext('2d', { colorSpace: 'srgb' })` e
   `createImageBitmap(f, { colorSpaceConversion: 'default' })`, os dois
   **explícitos**. Não evitam o `ICCP` — garantem que os **pixels** saiam em
   sRGB, que é o que torna a camada 2 segura;
2. `removerIccp()` tira o chunk e apaga o bit `ICC` do `VP8X` antes de
   subir. Cirurgia de contêiner, **sem recodificar**: o bitstream sai
   intacto. Perda zero, porque o perfil removido é o sRGB — que já é como
   toda imagem sem perfil é lida;
3. `inspecionarWebp()` lê os FourCC do resultado **antes de subir**, e
   reprova localmente com mensagem legível em vez de deixar virar 422.
   `EXIF` cai aqui, e **não** é removido: carrega metadado de verdade (GPS,
   entre outros), e sumir com ele em silêncio seria decidir por quem subiu.

**A ordem entre 2 e 3 é o conserto.** Invertida, o pré-voo reprova o arquivo
que a remoção consertaria em seguida — que era, literalmente, o defeito.

A camada 3 **não é uma segunda validação**: a autoridade continua sendo
`webp.validator.ts` no `back`, que confere ordem, cardinalidade e dimensão.
Aqui só se pergunta "apareceu chunk que eu sei que vai ser recusado?".

**O que os testes provam e o que não provam.** `jsdom` não tem canvas nem
encoder de WebP, então **nenhum teste comprime imagem de verdade** — a
costura `DependenciasDoNavegador` existe para isso, e adicionar o pacote
nativo `canvas` seria mudar a lista de dependências deste repositório por
causa de um teste. Provado: a conta de dimensão (varredura, não caso
escolhido), a leitura de chunk, e **os argumentos exatos** de
`getContext`/`createImageBitmap`/`toBlob`, e **a remoção do `ICCP`**
(remoção do chunk, queda do bit `ICC`, tamanho do RIFF recalculado, padding
de payload ímpar, idempotência e totalidade).

**A lacuna que este parágrafo declarava antes era o DEF-010.** Dizia: "não
provado, e é lacuna real: que um Chrome em tela Display P3 de fato não grava
`ICCP`". Ele grava — sempre, em qualquer tela. A lacuna foi fechada por
medição em Chrome 151 headless, e o conserto foi conferido ponta a ponta
contra o `webp.validator.ts` real, com um arquivo produzido por um Chrome de
verdade: antes `IMAGEM_COM_METADADOS`, depois `valido: true`.

**A lição, que vale além deste arquivo:** lacuna declarada com honestidade
ainda é lacuna. Esta ficou escrita, revisada e aprovada por sete rodadas de
validação cruzada, e continuou sendo o defeito até alguém rodar o navegador.

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

### A marca da arena, e onde ela se sobe (SPEC-018/TASK-006)

`logo-da-empresa.tsx` desenha; `logo-da-empresa-card.tsx` sobe. O cartão
mora em **`/configuracoes`**, primeiro na tela de propósito: é o único item
daquela página que muda o que o **aluno** vê, e o que aparece na página
pública de cadastro.

A logo substituiu a marca do PlayCK na **sidebar**, junto com o nome da
arena.

**SPEC-025 — as avaliações são a terceira aba da turma**, depois de
Presenças e Frequência. A ordem segue o mesmo princípio das duas primeiras:
as outras dizem quem apareceu, esta diz o que acharam — é a leitura que o
gestor procura quando desconfia de alguma coisa, não a que abre todo dia. A
lista vem **ordenada por pior nota** e com a contagem de detratores, porque o
pedido era achar o detrator, e ordenar por data enterraria o 1 da semana
passada embaixo dos 5 de ontem.

**A sidebar não é filha de Configurações**, e sem isso o gestor veria a logo
nova no cartão e a antiga no canto até recarregar — o que parece defeito, não
cache. A costura é um **evento de `window`** (`EVENTO_LOGO_TROCADA`),
despachado pelo `api-client` depois de subir ou remover: este projeto não tem
Redux, Zustand nem React Query, e um store inteiro por causa de um avatar
seria a decisão errada.

**A tela diz que a logo é pública antes do envio.** É a diferença que mais
importa em relação à foto de perfil: aquela é privada e a URL expira; esta
vai para o CDN e qualquer pessoa com o link abre.

### A foto do professor, e a única tela que avisa "deu certo e não mudou" (SPEC-018/TASK-004)

`foto-do-professor.tsx`, dentro de `edit-teacher-form`, em
`/pessoas/professores/[id]`. **Fica FORA do `<form>`**: sobe sozinha, na
hora, e não tem relação com o "Salvar" dos campos de texto — dentro do form,
o botão de escolher arquivo herdaria o `submit`.

**Esta é a única tela do produto onde um upload pode dar certo e a imagem não
mudar.** A INV-034 diz que quem tem conta manda na própria foto: se o
professor já subiu a dele, a que o gestor mandar fica gravada na ficha e não
aparece. Sem tratamento isso lê como falha silenciosa — o gestor tenta de
novo, com outro arquivo, e continua "não funcionando".

O componente compara a URL que voltou com a que já estava na tela; se forem
iguais **e** o professor tiver conta, mostra um `role="status"` explicando
que a foto foi salva e que a do perfil dele tem preferência. E antes de
qualquer upload, quando há conta, avisa que ela pode ser substituída.

**A foto é PRIVADA**, ao contrário da logo e da imagem de quadra — URL
assinada, que expira. A tela diz isso, porque é a diferença que decide o que
a pessoa se sente à vontade para subir. Também é por isso que não há
`next/image`: URL que muda a cada leitura não tem o que cachear.

### A turma acontece em N dias (SPEC-019/TASK-004)

`encontros-field` é o editor da recorrência, **compartilhado** por criar e
editar turma. Duas cópias divergiriam no primeiro ajuste, e a divergência
apareceria como *"na criação dá para remover o último e na edição não"* —
mesma razão do `catalogo-de-quadra-manager`.

**O estado é string de propósito.** `<Select>` e `<input type="time">`
trabalham com string; converter cedo obrigaria a converter de volta a cada
render, e um `Number("")` silencioso viraria `0` — **domingo** — sem
ninguém escolher domingo. A conversão acontece uma vez, no envio.

**A INV-051 aparece aqui sem duplicar a regra:** com um encontro só, o botão
de remover fica desabilitado. O servidor continua sendo quem garante
(`422 TURMA_SEM_ENCONTRO`); isto só evita que o gestor descubra a regra por
mensagem de erro depois de clicar. E o botão **diz por quê** — botão
desabilitado sem explicação é um mistério.

**A lista mostra uma linha por encontro**, não tudo concatenado: *"Seg,
07:00–08:00 · Qua, 18:00–19:30 · Sáb, 09:00–10:00"* numa célula de tabela
fica ilegível na terceira turma.

**E `SchoolClass`/`SchoolClassDetail` deixaram de ser escritos à mão** —
vêm do schema gerado (AC-016). Foi assim que a quebra da TASK-002 chegou:
regenerar os tipos deixou o typecheck deste repositório vermelho **com
arquivo e linha**, em vez de virar tela branca em produção.

### Os catálogos de quadra, e o beco que eles evitam (SPEC-020/TASK-005)

`/quadras/catalogos` guarda os **dois** catálogos — esportes e categorias de
piso — com um componente só (`catalogo-de-quadra-manager`), no molde de
`levels-manager`. Duas telas iguais seriam duas chances de divergirem, e a
divergência apareceria como *"no esporte dá pra apagar em uso e na categoria
não"*.

**Juntos numa rota só** porque são a mesma pergunta feita duas vezes: como
este clube classifica as quadras dele. Separados dariam duas entradas de menu
para uma decisão, e o gestor teria de descobrir que precisa visitar as duas.
**Desde a SPEC-053 não há mais entrada de menu nenhuma:** o caminho é o cartão
"Esportes e pisos" de `/reservas`.

**O `seletor-de-catalogo` substitui o `<Input>` de texto livre do esporte**,
que era a origem do defeito inteiro da SPEC-020: o filtro do app do aluno era
montado com os valores distintos digitados ali.

**E o estado vazio dele é a parte que importa.** Um `<select>` sem opções é
um beco — quem vem cadastrar a primeira quadra do clube não encontra nada e
não tem como saber que precisa cadastrar o catálogo antes. Lista vazia vira
**link para `/quadras/catalogos`**, não um seletor mudo.

**Falha de rede cai no mesmo caminho, de propósito:** os dois levam a abrir a
tela de catálogos, e um alarme separado não mudaria o que a pessoa faz.

### O menu passou a acender só o item mais específico

`adminItemIsActive` usava `startsWith`, e com `/quadras/catalogos` ao lado
de `/quadras` aquela rota acendia **as duas** entradas — uma por igualdade,
outra por prefixo. Menu com dois itens ativos não é feio, é **enganoso**: a
pessoa não sabe onde está, e o "voltar" que ela imagina não é o do botão.

O prefixo continua necessário (`/quadras/[id]` acende "Quadras"); o que
mudou é que ele só vale quando **nenhum item mais longo** casa.

**SPEC-053/D6 — um item pode acender fora do próprio `href`.** "Reservas"
(`/reservas`) precisa acender em `/quadras`, `/quadras/novo`, `/quadras/[id]` e
`/quadras/catalogos`, que não mudaram de endereço. O item ganhou `tambemEm`, e
a especificidade passou a ser o **prefixo mais longo que casa** entre o `href`
e os `tambemEm` de cada item. A comparação continua por segmento
(`${alvo}/`): `/quadrasx` e `/reservasx` não acendem nada. A sabotagem que
esvaziou o `tambemEm` derrubou os quatro casos de `/quadras` **e** a varredura
de sub-rotas — a garantia geral pegou sozinha o que o caso específico pega.

`admin-navigation.test.ts` varre o próprio menu: se alguém acrescentar outra
rota aninhada, o teste cai **no dia em que a ambiguidade nascer**.

### A reserva de mais de uma hora, e o `find` que cobrava duas vezes (2026-09-09)

**O servidor agrupa horários contíguos numa reserva só** (SPEC-011/AC-001):
escolher 19–20 e 20–21 grava **uma** ocupação `19:00–21:00`. A grade desenha
slots de 1 hora e casava reserva com slot por **igualdade** de hora de início —
então o slot das 20h não achava reserva nenhuma.

O resultado era o pior possível numa tela de dinheiro: a reserva de 2h **paga
com o crédito do aluno** mostrava "Pendente" e "Marcar pago" na segunda hora,
convidando o clube a cobrar de novo o que a carteira acabou de quitar. E os
botões eram no-op silencioso — os handlers repetiam o mesmo `find` e faziam
`if (!booking) return`, sem mensagem.

**O casamento agora é por intervalo** (`horaInicio <= hora && horaFim > hora`),
nos três pontos. O `>` e não `>=` importa: com `>=`, o slot das 21h casaria com
a reserva 19–21 em vez da 21–22, e o clique marcaria a reserva **errada** como
paga. *A primeira versão do teste dizia provar isso olhando um slot livre —
sabotado, ficava verde. Slot livre não mostra status de reserva; quem
discrimina é o par de reservas adjacentes.*

Achado pela revisão adversarial da `cliente#14`, que procurou a mesma classe de
defeito em outras telas.

### O aluno se busca no servidor, e a fila de aprovação diz o total (SPEC-049)

`pageSize` para em **`@Max(100)`** no servidor, e fica assim (D5): o teto
protege o banco, e a resposta para "preciso de mais de 100" é buscar.

- **`seletor-de-aluno`** substitui a lista de 100 em `court-manager`,
  `agenda-semana-acoes`, `class-manager` e `marcar-aula-particular`. Ele pede
  `GET /students?busca=` 300 ms depois da última tecla e descarta resposta
  atrasada. **O escolhido é guardado, não derivado da lista:** digitar outra
  busca não apaga a escolha (AC-007). A busca não ignora acento (LIM-049a), e
  a tela ensina o contorno.
- **`cadastros-pendentes`** mostra o `total` do servidor e pagina. O card
  dizia `(100)` com 340 na fila, e os mais antigos — quem esperou mais —
  sumiam.
- **O que ficou com lista de 100, e por quê:** professores e quadras
  (LIM-049d) — um clube não tem 100 de nenhum dos dois. **Aluno não tem mais
  lista em tela nenhuma:** o `court-manager` carregava `listStudents(1, 100)` só
  para escrever o nome no horário reservado, e o aluno 101 aparecia como
  "Aluno" (LIM-049e). **A SPEC-055 fechou isso** — a reserva traz `alunoNome` do
  servidor, e a chamada saiu (teste que exige nenhuma página de 100).
- **Integrada sobre a SPEC-054 em 2026-09-15:** as duas mexeram nos mesmos três
  formulários. O conflito da agenda semanal foi resolvido juntando os dois
  lados, e um caso de teste garante que ela continua buscando no servidor. Duas
  cargas de 100 alunos que ninguém mais lia saíram (`marcar-aula-particular` e
  `class-manager`).

### O seletor de adicionais, nos três lugares que criam reserva (SPEC-054/D12)

`seletor-de-adicionais` é **um componente só**, usado por `court-manager`,
`agenda-semana-acoes` (criar) e `marcar-aula-particular` — os três lugares em
que o gestor cria reserva avulsa. Três cópias divergiriam no primeiro ajuste,
pela mesma razão do `catalogo-de-quadra-manager`.

- **Ele não reserva nada.** Lê `GET /adicionais/disponiveis` para a data e os
  horários, e limita o `+` ao `disponivel`; a corrida termina em
  `409 ESTOQUE_ESGOTADO` no servidor (LIM-054j). Quem usa troca a `chave`, o
  seletor relê e **recorta** a escolha ao que sobrou.
- **Some quando não há adicional ativo** — e o `back` anterior à SPEC-054
  responde `404`, que `adicionaisDisponiveis` transforma em lista vazia. É o
  que deixa esta tela ir ao ar antes ou depois da Entrega B sem quebrar.
- **Informa a soma de UMA reserva; o total é de quem usa.** O adicional vale
  para cada reserva do pedido (D6), e horários separados são reservas
  separadas: `contarBlocos` repete a regra do servidor. A sabotagem que tirou o
  `contarBlocos` do total derrubou **só** o teste de dois horários separados —
  com um horário, 1 × soma e soma são o mesmo número, e nenhum outro caso
  distingue.
- **Sem escolha, o pedido não leva o campo `adicionais`** — nem `[]`. A
  impressão digital do pedido (D9) só é idêntica à de antes sem ele.

A "Nova reserva" da semana **não sabe o preço da quadra** (a grade não carrega
`precoHora`), e por isso diz *"Adicionais: + R$ 30,00 além do preço da
quadra"* em vez de um total que a tela não tem.

`itens-da-reserva` desenha os itens numa linha (`2× Raquete, 1× Bola`) e aceita
`undefined`: durante o rollout, o `back` anterior não manda o campo.

### O `Select` do Radix contra o jsdom

Dois muros que aparecem em **qualquer** teste que abra um `Select`, e por isso
valem para o próximo, não só para este:

- **`scrollIntoView` não existe no jsdom** e o Radix o chama: o teste morre com
  `candidate?.scrollIntoView is not a function`, erro que não menciona nem
  Radix nem jsdom. O stub mora em `vitest.setup.ts` — é limitação do ambiente.
- **O rótulo da opção é pintado duas vezes** (no `select` oculto de
  acessibilidade e na lista aberta). `findByText` morre com "found multiple
  elements"; `findByRole("option")` é o que distingue.

### A imagem da quadra, e a caixa que não é enfeite (SPEC-018/TASK-005)

`imagem-da-quadra-section.tsx`, dentro de `court-manager`, em
`/quadras/[id]`. Sobe pelo mesmo `comprimir-imagem.ts` da logo.

**O que ela tem a mais é a confirmação (AC-007..009), e cada peça responde
por um motivo diferente:**

| Peça | Por quê |
|---|---|
| aviso de que a imagem é **pública e permanente**, antes da caixa | sem ele a afirmação é cheque em branco: a pessoa confirma sem saber o quê |
| caixa do **produto**, não `confirm()` do navegador (AC-009) | `confirm()` é texto do sistema operacional: não dá para ler com calma, não fica na tela, some ao clicar |
| botão **desabilitado** enquanto a caixa não estiver marcada | deixar clicável e recusar no servidor faria a pessoa esperar o upload para ler que faltou marcar algo que está na frente dela |
| a caixa **desmarca depois de cada envio** | AC-008: a confirmação vale para *aquela* imagem. Marcada, a próxima troca herdaria uma afirmação que ninguém fez — e o banco registraria o nome de quem não afirmou |

**Nada disso é o gate.** O gate é o servidor: `curl` sem o campo leva 422
`CONFIRMACAO_OBRIGATORIA` e nada é gravado. Esta tela existe para que o
gestor **leia** o que afirma, e para não gastar um upload descobrindo.

**Um teste aqui nasceu de sabotagem que passou.** Trocar `confirmou` por um
`true` fixo na chamada deixava os 14 testes verdes, porque todos marcavam a
caixa antes de subir — nenhum distinguia o estado real do literal. O 15º
dispara o `change` do input **sem** marcar a caixa e exige `false` no fio.

**Sem `next/image`:** a URL é de CDN externo e o domínio teria de entrar em
`next.config.ts`. A regra do "NÃO existem no projeto" vale aqui — não se
carrega otimizador para host de terceiro por causa de uma foto.

### O prazo para desistir, e as duas armadilhas dele (SPEC-031/REQ-001)

Cartão em *Configurações*, entre o limite de turmas e o contrato — os três
decidem até onde vai o "sozinho" do aluno: quem entra, em quantas turmas, e
até quando dá para desistir.

**Vazio é "sem prazo", e é o padrão.** Empresa que nunca configurou nada não
passa a exigir antecedência — um número padrão qualquer seria regra inventada
entrando em vigor sem ninguém pedir. E vazio precisa ser **alcançável de
volta**, por isso o estado do formulário é `string` e não `number`: com número,
"apagar" e "zero" viram a mesma coisa na hora de mandar.

**A tela diz o que NÃO é sobre prazo.** Depois que a aula começa, cancelar é
sempre recusado — mesmo com os campos vazios. É a única mudança de
comportamento que a spec impõe a quem não pediu nada, e sem esse aviso o gestor
descobre pela reclamação do aluno.

#### Duas armadilhas achadas por auditoria adversarial, e as duas eram de dado

**1. O `PUT` é substituição total, e o cartão apagava o que não conseguiu
ler.** Com o `GET` falhado os dois campos ficavam vazios, e vazio quer dizer
`null`: o gestor digitava um prazo, salvava, e **apagava o outro**, recebendo
"Salvo.". O erro não foi mostrar o cartão — foi não distinguir *"vazio porque
não configurou"* de *"vazio porque não consegui ler"*. Hoje `leituraFalhou`
desabilita campo e botão, e "Recarregar" é a única saída.

**2. `type="number"` engolia o texto inválido.** O browser sanitiza: "24h",
"2-4" ou "-" chegam ao `onChange` como string **vazia** — que aqui significa
"sem prazo". Colar "24h" gravava a remoção do prazo dizendo "Salvo.". Hoje é
`type="text"` com `inputMode="numeric"`, e o parse é `/^\d+$/` e não
`Number()`, que aceita `0x10` como 16.

> **A lição não é sobre o cartão, é sobre o teste.** O arquivo de prova
> *afirmava o defeito*: rejeitava o `GET` e assertava que o `PUT` saía
> apagando o outro campo — verde na CI, defendendo a sobrescrita. Foi escrito
> sobre o que o código **fazia**, não sobre o que ele **devia fazer**.

## 10. Avisos do clube — push (SPEC-062/TASK-005)

**O que existe:** `public/sw.js` (antes só instalabilidade) trata `push`,
`notificationclick` e `pushsubscriptionchange`;
`src/lib/push-reconciliacao.ts` (decisão, sem navegador),
`src/lib/push-do-navegador.ts` (`PushManager` + API), `src/lib/sair.ts`, e o
card `AvisosDoClube` nas configurações.

**É cópia do `cliente`, e isso é a decisão.** `push-reconciliacao.ts`, o teste
dele, o `sw.js` e o componente vieram de lá, com o visual desta casa. Poly-repo
sem pacote compartilhado (ADR-001) — o mesmo custo declarado do
`comprimir-imagem.ts`, e **sem gate de sincronia**: se um dos dois ganhar um
caso, o outro não fica sabendo.

**O que MUDA em relação ao `cliente`, e não é cosmético:**

| | `cliente` | `admin` |
|---|---|---|
| logout | `POST /auth/logout` + limpar token | **só local** (`clearAccessToken`) |
| `ApiError` | `code` é o 3º parâmetro | **o 4º** — há um `conflictWith` antes |

A primeira diferença torna a ordem **mais** crítica aqui: o
`DELETE /push/assinatura` precisa do token, e `clearAccessToken()` o apaga.
Invertido, a linha fica no banco até o primeiro `410`. A segunda foi pega pelo
`tsc` ao copiar o teste — a chamada do `cliente` compilava errado aqui.

**Três regras que não são preferência** (idênticas ao `cliente`):
`showNotification()` em **todo** push, inclusive no `catch` (o WebKit revoga a
assinatura de quem recebe e não mostra); `requestPermission()` **só dentro de
um gesto** (pedir na abertura leva "bloquear", e bloqueio não se desfaz sem ir
às configurações do sistema); e o interruptor com **quatro** estados, `erro`
entre eles — **nunca `ligado` por otimismo**.

| Regra de camada | Gate |
|---|---|
| credencial de assinatura nunca em log ou resposta | revisão |
| `requestPermission()` só em manipulador de evento | **prova de tela**: `avisos-do-clube.test.tsx` |
| `push-reconciliacao.ts` idêntico ao do `cliente` | **não existe gate** — custo declarado (ADR-001) |


### A caixa de avisos, e o sino que leva a ela (SPEC-065)

O push entrega **ou perde**: a SPEC-062 declarava, em LIM-062b, que *"sem
assinatura viva, o aviso se perde; nao ha caixa de entrada"*. Era um limite
barato enquanto o clube nao mandava nada, e deixou de ser quando a SPEC-063
pos os treze gestos no ar.

| O que | Onde |
|---|---|
| a tela | `/avisos` -> `components/caixa-de-avisos.tsx` |
| o sino, com contagem | `components/sino-de-avisos.tsx`, no topo |
| as travas contra rajada | `lib/contador-de-avisos.ts` |
| o gancho do push | `public/sw.js`, mensagem `playck:aviso-novo` |

**Abrir a caixa marca tudo como lido**, e nao ha estado por item: a
alternativa nao tem resposta boa (*o que conta como ter lido -- aparecer na
tela? ficar dois segundos? tocar?*), e marcacao arbitraria e pior que
marcacao grossa e previsivel.

#### O contador NAO faz polling, e as tres travas explicam por que ele nao precisa

Ele sobe em dois momentos: a abertura do app, e a chegada de um push. O
segundo era um gancho que **nao existia** -- o `sw.js` mostrava a notificacao
e as abas so descobriam na proxima abertura.

E rajada e o caso **normal**: um gesto que avisa vinte alunos sao vinte
pushes; tres abas abertas dariam sessenta consultas. Tres travas, uma linha
cada:

| Trava | Corta |
|---|---|
| so a aba **visivel** consulta | o numero de abas |
| **debounce** de 2 s -- evento novo REAGENDA, nao soma | a rajada |
| **single-flight** -- com pedido em voo, o proximo nao comeca | a corrida |

`P x A` vira ~1.

**O push de teste nao mexe no contador**: ele e diagnostico do canal, nao
recado do clube, e a caixa nao o mostra. Sem esse `if`, o numero subiria por
um aviso que a pessoa nao acharia ao abrir.

**A aba que marca tudo como lido posta `playck:avisos-lidos`**, e as outras
zeram **sem consultar**. Sem isso, uma aba marcaria lido e a outra seguiria
mostrando numero positivo -- o caso que derrubou a primeira versao da spec,
quando eu afirmei que a contagem "so erra para menos" sem testar a direcao
contraria.

#### O que e duplicado, e o custo declarado

`caixa-de-avisos.tsx`, `sino-de-avisos.tsx`, `contador-de-avisos.ts` e o teste
dele sao **identicos byte a byte** nos dois fronts -- poly-repo sem pacote
compartilhado (ADR-001), o mesmo custo do `netlify-ignore.mjs` e do
`gates-de-push.mjs`. **Nao ha gate de sincronia**: mudanca num tem de ser
copiada no outro a mao.

**Uma armadilha que so apareceu rodando:** o primeiro rascunho usava
`--color-on-surface-variant`, token do Admin que **nao existe no Cliente**. O
`cores.test.ts` pegou. *Componente identico nos dois fronts exige token que
exista nos dois* -- e o que existe e `--color-text-secondary`.

**O sino do Admin era INERTE desde a SPEC-008**, e deixou de ser aqui -- pela
mesma razao que a engrenagem deixou na SPEC-010: *"um botao que nao faz nada
quando ja existe destino e pior do que nao ter o botao"*.

**O `Paginacao` veio do `cliente` neste ciclo**, porque a caixa e o mesmo
componente nos dois. **As listas que ja existiam aqui NAO foram migradas** --
cada uma tem sua paginacao inline, e troca-las seria refatoracao sem pedido no
meio de outra entrega. Divida nomeada: **existem dois jeitos de paginar no
`admin` agora**, e o novo e o componente.

## 11. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | ~~**`api-types.ts` pode ficar stale**~~ — **fechado na SPEC-067**, pelo job `contrato` contra o contrato fixado por SHA; resta o ruleset exigi-lo (TASK-004). O histórico: o CI não comparava com o `openapi.json` do `back`, e **não tinha como** — em poly-repo o checkout do frontend não vê `../Back`. Este gap estava escrito aqui e **aconteceu de novo**: em 2026-08-26 causou o DEF-012, um apagão de três telas no app do aluno. Desde então existe `pnpm run api-types:check` (local, exit 1 se stale — provado nos dois sentidos), mas **um comando que ninguém roda não é gate** | **Alta** |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes. **A grade da semana saiu dessa lista em 2026-09-05**, e por um motivo que vale registrar: os dois defeitos de estado dela (o diálogo que movia a reserva ERRADA e a corrida de fetch) foram achados por **revisão do diff**, não por teste, e o terceiro (quadra homônima) por validação cruzada. Os três só ganharam rede DEPOIS — `agenda-semana.test.tsx`. Componente sem teste aqui não é dívida abstrata: é onde os três moraram | Média |
| 5 | Ícones e paleta ainda derivados de inferência, sem arquivo de marca oficial | Baixa |
