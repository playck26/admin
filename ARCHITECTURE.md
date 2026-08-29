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
| `/quadras` (+ `novo`, `[id]`, **`catalogos`**) | `courts-list`, `court-manager`, `imagem-da-quadra-section`, `horario-quadra-section`, **`catalogo-de-quadra-manager`**, **`seletor-de-catalogo`** | quadras, disponibilidade, reserva, horário próprio e, desde a **SPEC-018/TASK-005**, a imagem da quadra com a confirmação obrigatória |
| `/turmas` (+ `novo`, `[id]`) | `classes-list`, `class-manager`, `turma-chamada-abas` → `presencas-turma` \| `frequencia-turma` | turmas e alocação; presença e frequência são **abas uma da outra** (**SPEC-015**), porque são duas leituras do mesmo dado — "Presenças" primeiro, que é o registro; "Frequência" depois, que é a interpretação dele |
| `/pagamentos` | `payment-config-form` | meio de pagamento e confirmação |
| `/configuracoes` | `configuracoes-view` + `link-cadastro-card` + `limite-de-turmas-card` + `contrato-do-clube-card` | horário padrão da empresa e, desde a **DEF-003**, o link de auto-cadastro pronto para copiar (`GET /me/company`) — o `slug` existia desde a SPEC-009 e não chegava a tela nenhuma. **DEF-004:** o mesmo card liga e desliga o auto-cadastro (`PATCH /me/company`), cumprindo o REQ-006 da SPEC-009, que era lido em dois lugares e escrito em nenhum. **SPEC-023:** o `limite-de-turmas-card` entrou logo abaixo — os dois decidem até onde vai o "sozinho" do aluno, um controlando quem entra no clube e o outro em quantas turmas. Campo vazio = sem limite, que é o padrão; a tela avisa que o limite **não expulsa ninguém** (INV-023a), porque quem configura precisa saber o que NÃO vai acontecer. **SPEC-024:** o `contrato-do-clube-card` escreve e publica o contrato — e publicar exige um passo de confirmação que mostra **quantas pessoas terão que reaceitar**, com o número na frente. Botão "Publicar" sem esse aviso parece salvar rascunho, e não é: interrompe cada aluno no próximo acesso. Também avisa que **não existe despublicar** (LIM-024a) |

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

`admin-navigation.test.ts` varre o próprio menu: se alguém acrescentar outra
rota aninhada, o teste cai **no dia em que a ambiguidade nascer**.

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

## 10. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | **`api-types.ts` pode ficar stale**: o CI não compara com o `openapi.json` do `back`, e **não tem como** — em poly-repo o checkout do frontend não vê `../Back`. Este gap estava escrito aqui e **aconteceu de novo**: em 2026-08-26 causou o DEF-012, um apagão de três telas no app do aluno. Desde então existe `pnpm run api-types:check` (local, exit 1 se stale — provado nos dois sentidos), mas **um comando que ninguém roda não é gate** | **Alta** |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
| 5 | Ícones e paleta ainda derivados de inferência, sem arquivo de marca oficial | Baixa |
