import type { components } from "./api-types";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];
export type CreateStudentDto = components["schemas"]["CreateStudentDto"];
export type UpdateStudentDto = components["schemas"]["UpdateStudentDto"];
export type CreateTeacherDto = components["schemas"]["CreateTeacherDto"];
export type UpdateTeacherDto = components["schemas"]["UpdateTeacherDto"];
export type CreateLevelDto = components["schemas"]["CreateLevelDto"];
export type UpdateLevelDto = components["schemas"]["UpdateLevelDto"];
export type CreateCourtDto = components["schemas"]["CreateCourtDto"];
export type UpdateCourtDto = components["schemas"]["UpdateCourtDto"];
export type CreateBookingDto = components["schemas"]["CreateBookingDto"];
export type CreateClassDto = components["schemas"]["CreateClassDto"];
export type UpdateClassDto = components["schemas"]["UpdateClassDto"];
export type UpdatePaymentConfigDto = components["schemas"]["UpdatePaymentConfigDto"];

export type LoginResult = components["schemas"]["LoginResponseDto"];

export type Student = components["schemas"]["AlunoResponseDto"];

/**
 * SPEC-009/AC-006 — a senha temporária vem **uma única vez**, na resposta
 * que a criou. Nenhuma outra rota a devolve, então a tela precisa mostrá-la
 * no ato: se o admin fechar sem copiar, o caminho é gerar outra.
 */
/**
 * SPEC-009/AC-006 — a senha temporária vem **uma única vez**, na resposta que
 * a criou. É DTO próprio no contrato, e não `Student & { senha }`: um campo
 * opcional no tipo comum faria toda leitura de aluno parecer capaz de trazer
 * senha, e quem integra passaria a procurá-la onde ela nunca vai estar.
 */
export type StudentComSenha =
  components["schemas"]["AlunoComSenhaTemporariaResponseDto"];

export type Teacher = components["schemas"]["ProfessorResponseDto"];

export type Level = components["schemas"]["NivelResponseDto"];

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * SPEC-020/TASK-007 — **estes tipos eram escritos à mão, e mentiam.**
 *
 * `Court.esporte` era tipado como a linha inteira do catálogo
 * (`OpcaoDeQuadra`, com `ordem`, `companyId`, `createdAt`), mas a API embute
 * só `{ id, nome }`. Ninguém quebrou por causa disso — mas qualquer código
 * que lesse `quadra.esporte.ordem` teria `undefined` em runtime com o
 * typecheck concordando.
 *
 * **É o DEF-012 na direção oposta:** lá o tipo negava o objeto, aqui promete
 * campos que não chegam. A causa é a mesma — tipo escrito à mão é uma
 * afirmação sobre o contrato, não o contrato.
 *
 * Agora vêm do `openapi.json`, e são dois tipos distintos de propósito: o
 * embutido na quadra e a linha inteira que `/court-sports` devolve.
 */
export type OpcaoDeQuadra =
  components["schemas"]["CatalogoDeQuadraResponseDto"];
/** O que vem embutido na quadra: só o que a tela mostra e o filtro compara. */
export type OpcaoEmbutidaNaQuadra =
  components["schemas"]["OpcaoDeCatalogoResponseDto"];
export type Court = components["schemas"]["QuadraResponseDto"];

export type AvailabilitySlot = components["schemas"]["SlotDeDisponibilidadeResponseDto"];

export type Availability = components["schemas"]["DisponibilidadeResponseDto"];

export type Booking = components["schemas"]["OcupacaoResponseDto"];

export interface BookingConflictInfo {
  ocupacaoId: string;
  origemTipo: string;
}

export type PaymentConfig = components["schemas"]["ConfiguracaoDePagamentoResponseDto"];

/**
 * SPEC-019/REQ-006 (AC-016) — **estes tipos eram escritos à mão, e diziam
 * `diaSemana`.**
 *
 * Enquanto fossem locais, trocar a forma da resposta no `back` deixaria o
 * typecheck daqui verde e a tela quebrada em runtime — exatamente o DEF-012,
 * que em 2026-08-26 apagou três telas do app do aluno em produção.
 *
 * Agora vêm do `openapi.json`, que vem do `TurmaResponseDto` do `back`, que
 * está amarrado ao retorno de `toResponse`. A corrente inteira acende
 * vermelho antes de chegar a um usuário (SPEC-021/INV-058, INV-059).
 */
export type EncontroDaTurma =
  components["schemas"]["TurmaEncontroResponseDto"];
export type SchoolClass = components["schemas"]["TurmaResponseDto"];
export type SchoolClassStudent =
  components["schemas"]["AlunoDaTurmaResponseDto"];
export type SchoolClassDetail =
  components["schemas"]["TurmaDetalheResponseDto"];

export type DashboardSummary = components["schemas"]["DashboardResumoResponseDto"];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public conflictWith?: BookingConflictInfo,
  ) {
    super(message);
  }
}

async function parseError(res: Response, fallback: string): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : fallback;
  const conflictWith =
    body && typeof body === "object" && "conflictWith" in body
      ? (body.conflictWith as BookingConflictInfo | undefined)
      : undefined;
  return new ApiError(res.status, message, conflictWith);
}

/**
 * Renova o access token usando o refresh token do cookie httpOnly.
 *
 * O backend implementa rotação de refresh desde a SPEC-001 (REQ-003), mas
 * nenhum frontend chamava esta rota: o access token vale 15 minutos, e
 * qualquer ação depois disso morria com "Unauthorized" no meio da tela.
 * Passava despercebido porque, em teste, o intervalo entre logar e agir
 * era sempre menor que 15 minutos.
 *
 * `credentials: "include"` é obrigatório — é o que manda o cookie de
 * refresh (httpOnly, `SameSite=Strict`, path `/api/v1/auth`).
 */
let renovacaoEmCurso: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  // Várias requisições podem receber 401 ao mesmo tempo (uma tela que
  // carrega três listas, por exemplo). Sem esta trava, cada uma dispararia
  // um refresh, e a rotação do backend trataria as concorrentes como reuso
  // de token — revogando a sessão inteira, que é o oposto do desejado.
  if (renovacaoEmCurso) return renovacaoEmCurso;

  renovacaoEmCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const { accessToken } = (await res.json()) as { accessToken: string };
      saveAccessToken(accessToken);
      return true;
    } catch {
      return false;
    } finally {
      renovacaoEmCurso = null;
    }
  })();

  return renovacaoEmCurso;
}

function encerrarSessao(): void {
  clearAccessToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    // Navegação dura de propósito, em vez de `router.push`: este módulo não
    // é componente (não há hook disponível) e, mais importante, sessão
    // perdida deve descartar todo o estado em memória — cache de listas,
    // formulário pela metade, dados de outro usuário. Um push do Next
    // preservaria isso.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
}

async function temCodigo(res: Response, codigo: string): Promise<boolean> {
  try {
    const body: unknown = await res.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      (body as { code?: string }).code === codigo
    );
  } catch {
    return false;
  }
}

async function requisicaoAutenticada(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = getAccessToken();
  // SPEC-018/TASK-003 — **`FormData` não pode levar `Content-Type` nosso.**
  // Quem monta o cabeçalho de multipart é o navegador, porque só ele conhece
  // o `boundary` que separa as partes. Mandar `application/json` junto de um
  // corpo multipart faz o servidor tentar parsear o corpo como JSON: o campo
  // `arquivo` nunca chega, e o erro que aparece é "envie o arquivo no campo
  // arquivo" — que manda quem for investigar para o lado errado.
  const ehFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(ehFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await requisicaoAutenticada(path, init);

  // 401 aqui quase sempre é access token vencido, não credencial errada:
  // tenta renovar uma vez e repete. Se a renovação falhar, a sessão acabou
  // de verdade — manda para o login em vez de mostrar "Unauthorized" no
  // meio de um formulário.
  // SPEC-013/INV-013 — conta inativada enquanto a sessão estava aberta. O
  // servidor passa a responder 403 CONTA_INATIVA em toda rota, e um 403 não
  // dispara a renovação logo abaixo: sem este desvio a pessoa ficaria presa
  // numa tela viva cheia de erros, sem entender que perdeu o acesso.
  // Encerra a sessão como se fosse expiração, porque para ela é isso mesmo.
  // SPEC-014:TASK-000 / INV-008 — o servidor barra tudo enquanto a senha for
  // temporaria. Sem este desvio a pessoa veria erro seco em cada tela em vez
  // da unica tela que resolve o problema dela.
  if (res.status === 403 && (await temCodigo(res.clone(), "SENHA_TEMPORARIA"))) {
    if (typeof window !== "undefined" && window.location.pathname !== "/primeiro-acesso") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/primeiro-acesso";
    }
    throw new ApiError(403, "Crie sua senha para continuar.");
  }

  if (res.status === 403 && (await temCodigo(res.clone(), "CONTA_INATIVA"))) {
    encerrarSessao();
    throw await parseError(res, "Esta conta está inativa. Procure o administrador.");
  }

  // DEF-008 (2026-08-24) — 403 puro, sem código conhecido, quase sempre é
  // **claim velha no token**, não falta de permissão de verdade.
  //
  // O servidor autoriza pelo TOKEN (`role` e `companyId` das claims); o app
  // navega e filtra pelo `/auth/me`, que lê do BANCO. Quando o papel ou a
  // empresa de alguém muda, os dois discordam até o próximo login — e como
  // 403 nunca disparava a renovação, a divergência **não tinha como se
  // resolver sozinha**.
  //
  // No Admin o sintoma foi pior que um erro: `companyId` velho no token faz
  // toda consulta ser escopada para a empresa **errada**, e a tela mostra
  // zero aluno, zero quadra, zero turma — **sem erro nenhum no console**.
  // Dado que some sem mensagem é pior que erro na cara.
  //
  // A renovação relê o usuário do banco e reemite o token com as claims
  // atuais. Se depois disso ainda for 403, aí é permissão de verdade.
  if (res.status === 403) {
    const renovou = await renovarSessao();
    if (renovou) {
      res = await requisicaoAutenticada(path, init);
    }
  }

  if (res.status === 401) {
    const renovou = await renovarSessao();
    if (!renovou) {
      encerrarSessao();
      throw await parseError(res, "Sua sessão expirou. Entre novamente.");
    }
    res = await requisicaoAutenticada(path, init);
    if (res.status === 401) {
      encerrarSessao();
      throw await parseError(res, "Sua sessão expirou. Entre novamente.");
    }
  }

  if (!res.ok) {
    throw await parseError(res, "Não foi possível completar a operação");
  }

  return res;
}

export async function login(dto: LoginDto): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw await parseError(res, "Não foi possível entrar");
  }

  return (await res.json()) as LoginResult;
}

export async function listStudents(page = 1, pageSize = 20): Promise<Paginated<Student>> {
  const res = await authFetch(`/students?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as Paginated<Student>;
}

export async function createStudent(dto: CreateStudentDto): Promise<StudentComSenha> {
  const res = await authFetch("/students", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as StudentComSenha;
}

/** SPEC-009/REQ-005 — gera uma senha temporária nova para o aluno. */
export async function regenerarSenhaTemporaria(
  id: string,
): Promise<StudentComSenha> {
  const res = await authFetch(`/students/${id}/senha-temporaria`, {
    method: "POST",
  });
  return (await res.json()) as StudentComSenha;
}

/**
 * SPEC-009/REQ-002 — cria um convite. O `token` volta **uma única vez**,
 * nesta resposta: é ele que vira o link que o admin encaminha.
 */
export type ConviteCriado = components["schemas"]["ConviteCriadoResponseDto"];

export async function criarConvite(dto: {
  nome?: string;
  email?: string;
  telefone?: string;
  nivelId?: string;
}): Promise<ConviteCriado> {
  const res = await authFetch("/invites", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  return (await res.json()) as ConviteCriado;
}

/** SPEC-009/REQ-008 — fila de aprovação e decisão sobre um cadastro. */
export async function listStudentsPendentes(): Promise<Paginated<Student>> {
  const res = await authFetch(`/students?vinculo=pendente&pageSize=100`);
  return (await res.json()) as Paginated<Student>;
}

export async function aprovarAluno(id: string): Promise<Student> {
  const res = await authFetch(`/students/${id}/aprovar`, { method: "POST" });
  return (await res.json()) as Student;
}

export async function recusarAluno(id: string): Promise<Student> {
  const res = await authFetch(`/students/${id}/recusar`, { method: "POST" });
  return (await res.json()) as Student;
}

export async function getStudent(id: string): Promise<Student> {
  const res = await authFetch(`/students/${id}`);
  return (await res.json()) as Student;
}

export async function updateStudent(id: string, dto: UpdateStudentDto): Promise<Student> {
  const res = await authFetch(`/students/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as Student;
}

export async function listTeachers(page = 1, pageSize = 20): Promise<Paginated<Teacher>> {
  const res = await authFetch(`/teachers?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as Paginated<Teacher>;
}

export async function createTeacher(dto: CreateTeacherDto): Promise<Teacher> {
  const res = await authFetch("/teachers", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as Teacher;
}

export async function getTeacher(id: string): Promise<Teacher> {
  const res = await authFetch(`/teachers/${id}`);
  return (await res.json()) as Teacher;
}

export type TeacherComSenha =
  components["schemas"]["ProfessorComSenhaTemporariaResponseDto"];

/**
 * SPEC-013 — cria ou rotaciona o acesso do professor. A senha volta em
 * texto claro **uma única vez**, nesta resposta; nenhuma outra rota a
 * devolve. Por isso quem chama tem de mostrá-la antes de navegar.
 */
export async function gerarAcessoProfessor(id: string): Promise<TeacherComSenha> {
  const res = await authFetch(`/teachers/${id}/acesso`, { method: "POST" });
  return (await res.json()) as TeacherComSenha;
}

export async function updateTeacher(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
  const res = await authFetch(`/teachers/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as Teacher;
}

export async function listLevels(): Promise<Level[]> {
  const res = await authFetch("/levels");
  return (await res.json()) as Level[];
}

export async function createLevel(dto: CreateLevelDto): Promise<Level> {
  const res = await authFetch("/levels", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as Level;
}

export async function updateLevel(id: string, dto: UpdateLevelDto): Promise<Level> {
  const res = await authFetch(`/levels/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as Level;
}

export async function deleteLevel(id: string): Promise<void> {
  await authFetch(`/levels/${id}`, { method: "DELETE" });
}

export async function listCourts(page = 1, pageSize = 20): Promise<Paginated<Court>> {
  const res = await authFetch(`/courts?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as Paginated<Court>;
}

export async function createCourt(dto: CreateCourtDto): Promise<Court> {
  const res = await authFetch("/courts", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as Court;
}

export async function getCourt(id: string): Promise<Court> {
  const res = await authFetch(`/courts/${id}`);
  return (await res.json()) as Court;
}

export async function updateCourt(id: string, dto: UpdateCourtDto): Promise<Court> {
  const res = await authFetch(`/courts/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as Court;
}

export async function getAvailability(quadraId: string, data: string): Promise<Availability> {
  const res = await authFetch(`/courts/${quadraId}/availability?data=${data}`);
  return (await res.json()) as Availability;
}

/**
   * SPEC-011 — um pedido pode gerar mais de uma reserva: slots contíguos
   * viram um bloco, separados viram reservas independentes. O agrupamento
   * é do servidor, para o app do aluno e o painel não divergirem sobre o
   * que é "uma reserva".
   */
export async function createBooking(dto: {
  quadraId: string;
  data: string;
  slots: { horaInicio: string; horaFim: string }[];
  alunoId?: string;
}): Promise<{ reservas: Booking[] }> {
  const res = await authFetch("/bookings", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as { reservas: Booking[] };
}

export async function listBookings(filters: { data?: string; status?: string } = {}): Promise<Paginated<Booking>> {
  const params = new URLSearchParams();
  if (filters.data) params.set("data", filters.data);
  if (filters.status) params.set("status", filters.status);
  params.set("pageSize", "100");
  const res = await authFetch(`/bookings?${params.toString()}`);
  return (await res.json()) as Paginated<Booking>;
}

export async function cancelBooking(id: string): Promise<void> {
  await authFetch(`/bookings/${id}/cancel`, { method: "POST" });
}

export async function listClasses(page = 1, pageSize = 20): Promise<Paginated<SchoolClass>> {
  const res = await authFetch(`/classes?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as Paginated<SchoolClass>;
}

export async function createClass(dto: CreateClassDto): Promise<SchoolClass> {
  const res = await authFetch("/classes", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as SchoolClass;
}

export async function getClass(id: string): Promise<SchoolClassDetail> {
  const res = await authFetch(`/classes/${id}`);
  return (await res.json()) as SchoolClassDetail;
}

export async function updateClass(id: string, dto: UpdateClassDto): Promise<SchoolClass> {
  const res = await authFetch(`/classes/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as SchoolClass;
}

export async function allocateStudentInClass(classId: string, alunoId: string): Promise<void> {
  await authFetch(`/classes/${classId}/students/${alunoId}`, { method: "POST" });
}

export async function removeStudentFromClass(classId: string, alunoId: string): Promise<void> {
  await authFetch(`/classes/${classId}/students/${alunoId}`, { method: "DELETE" });
}

export async function getDashboardSummary(periodo?: string): Promise<DashboardSummary> {
  const params = periodo ? `?periodo=${periodo}` : "";
  const res = await authFetch(`/dashboard/summary${params}`);
  return (await res.json()) as DashboardSummary;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const res = await authFetch("/payment-config");
  return (await res.json()) as PaymentConfig;
}

export async function updatePaymentConfig(dto: UpdatePaymentConfigDto): Promise<PaymentConfig> {
  const res = await authFetch("/payment-config", { method: "PUT", body: JSON.stringify(dto) });
  return (await res.json()) as PaymentConfig;
}

export async function updateBookingPaymentStatus(
  id: string,
  status: "pago" | "cancelado",
): Promise<Booking> {
  const res = await authFetch(`/bookings/${id}/payment-status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return (await res.json()) as Booking;
}

// =====================================================================
// SPEC-010 — horário de funcionamento
// =====================================================================

export type DiaHorario = components["schemas"]["DiaDeHorarioResponseDto"];

export type OcupacaoAfetada = components["schemas"]["OcupacaoAfetadaResponseDto"];

/**
 * SPEC-010/REQ-006 — reduzir o horário não cancela nada; devolve o que
 * ficou fora para o gerente decidir.
 */
export type ResultadoHorarios = components["schemas"]["ResultadoDeHorariosResponseDto"];

export type HorariosEmpresa = components["schemas"]["ConfiguracaoDeHorariosResponseDto"];

/**
 * DEF-003 — identidade da própria empresa, para o gestor divulgar o link de
 * auto-cadastro. O `slug` existia desde a SPEC-009 e não chegava a nenhuma
 * tela.
 */
export type MinhaEmpresa = components["schemas"]["MinhaEmpresaResponseDto"];

export async function getMinhaEmpresa(): Promise<MinhaEmpresa> {
  const res = await authFetch("/me/company");
  return (await res.json()) as MinhaEmpresa;
}

// ---------------------------------------------------------------------------
// SPEC-018/TASK-006 — a logo da empresa
// ---------------------------------------------------------------------------

export type LogoResolvida = components["schemas"]["LogoDaEmpresaResponseDto"];

/**
 * **A sidebar precisa saber que a logo mudou, e ela não é filha da tela de
 * configurações.** Sem isto, o gestor sobe a logo, vê a nova no cartão, e a
 * do canto continua a antiga até ele recarregar a página — parece defeito.
 *
 * Um evento de `window` em vez de estado global: este projeto não tem Redux,
 * Zustand nem React Query (a planta declara isso), e um store inteiro por
 * causa de um avatar seria a decisão errada. Quem quiser ouvir, ouve.
 */
export const EVENTO_LOGO_TROCADA = "playck:logo-trocada";

function anunciarLogo(logo: LogoResolvida): LogoResolvida {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<LogoResolvida>(EVENTO_LOGO_TROCADA, { detail: logo }),
    );
  }
  return logo;
}

/**
 * O `arquivo` já vem **comprimido** por `comprimir-imagem.ts`. Subir o
 * original seria 413 — o servidor recusa acima de 2 MB.
 */
export async function enviarLogo(
  companyId: string,
  arquivo: File,
): Promise<LogoResolvida> {
  const corpo = new FormData();
  // Nome do campo é contrato (CON-017.1); errar aqui dá 400, não 422.
  corpo.append("arquivo", arquivo);
  const res = await authFetch(`/companies/${companyId}/logo`, {
    method: "PUT",
    body: corpo,
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível enviar a logo");
  }
  return anunciarLogo((await res.json()) as LogoResolvida);
}

/**
 * Devolve a logo **resolvida**, não vazio: se a empresa tinha `logo_url`
 * externa, ela volta a valer (AC-013), e a tela precisa saber disso.
 */
export async function removerLogo(companyId: string): Promise<LogoResolvida> {
  const res = await authFetch(`/companies/${companyId}/logo`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível remover a logo");
  }
  return anunciarLogo((await res.json()) as LogoResolvida);
}

/** SPEC-018/TASK-004 — o que o `PUT`/`DELETE` da foto devolve. */
export type FotoDeProfessorResolvida = components["schemas"]["FotoDeProfessorResponseDto"];

/**
 * SPEC-018/TASK-004 — sobe a foto do professor pela ficha.
 *
 * **O que volta pode não ser o que subiu**, e isso é a INV-034 funcionando:
 * se o professor tem conta e já subiu a própria foto, a dele continua sendo
 * a exibida. Por isso a resposta é usada, e não descartada — a tela precisa
 * saber o que vai mostrar para não sugerir que o upload falhou.
 */
export async function enviarFotoDeProfessor(
  professorId: string,
  arquivo: File,
): Promise<FotoDeProfessorResolvida> {
  const corpo = new FormData();
  // Nome do campo é contrato (CON-017.1); errar aqui dá 400, não 422.
  corpo.append("arquivo", arquivo);
  const res = await authFetch(`/teachers/${professorId}/foto`, {
    method: "PUT",
    body: corpo,
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível enviar a foto do professor");
  }
  return (await res.json()) as FotoDeProfessorResolvida;
}

/**
 * AC-010 — apagar sem substituir.
 *
 * **Pode não deixar a tela vazia:** apaga só `professores.foto_key`. Se a
 * pessoa tem foto própria, ela passa a aparecer.
 */
export async function removerFotoDeProfessor(
  professorId: string,
): Promise<FotoDeProfessorResolvida> {
  const res = await authFetch(`/teachers/${professorId}/foto`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível remover a foto do professor");
  }
  return (await res.json()) as FotoDeProfessorResolvida;
}

/**
 * SPEC-020/TASK-005 — os dois catálogos, com **uma** família de funções.
 *
 * O caminho é o único parâmetro que muda, e o servidor já trata os dois com
 * a mesma base (`CatalogoDeQuadraService`). Duas famílias de funções aqui
 * seriam duas chances de o cliente divergir do servidor em um dos lados.
 */
export type CatalogoDeQuadra = "court-sports" | "court-categories";

export async function listarCatalogo(
  catalogo: CatalogoDeQuadra,
): Promise<OpcaoDeQuadra[]> {
  const res = await authFetch(`/${catalogo}`);
  if (!res.ok) {
    throw await parseError(res, "Não foi possível carregar as opções");
  }
  return (await res.json()) as OpcaoDeQuadra[];
}

export async function criarOpcaoDeCatalogo(
  catalogo: CatalogoDeQuadra,
  dto: { nome: string; ordem?: number },
): Promise<OpcaoDeQuadra> {
  const res = await authFetch(`/${catalogo}`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível criar a opção");
  }
  return (await res.json()) as OpcaoDeQuadra;
}

export async function renomearOpcaoDeCatalogo(
  catalogo: CatalogoDeQuadra,
  id: string,
  dto: { nome?: string; ordem?: number },
): Promise<OpcaoDeQuadra> {
  const res = await authFetch(`/${catalogo}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível renomear a opção");
  }
  return (await res.json()) as OpcaoDeQuadra;
}

/**
 * **O 422 daqui é informação, não falha.** O servidor recusa apagar opção em
 * uso e devolve `quadras`, a contagem. Quem chama mostra isso — "está em uso
 * por 3 quadras" é acionável; "não foi possível remover" não é.
 */
export async function removerOpcaoDeCatalogo(
  catalogo: CatalogoDeQuadra,
  id: string,
): Promise<void> {
  const res = await authFetch(`/${catalogo}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível remover a opção");
  }
}

/** SPEC-018/TASK-005 — o que o `PUT`/`DELETE` da imagem devolve. */
export type ImagemDeQuadraResolvida = components["schemas"]["ImagemDaQuadraResponseDto"];

/**
 * SPEC-018/TASK-005 — sobe a imagem da quadra.
 *
 * **O `semPessoasIdentificaveis` vai no FormData, e vai como a string
 * `"true"`.** Não é descuido de tipagem: multipart não transporta boolean,
 * e o servidor recusa qualquer coisa que não seja exatamente `"true"` —
 * inclusive `"false"`, que um `String(false)` produziria e que
 * `Boolean("false")` aceitaria do lado de lá. Por isso o parâmetro aqui é
 * um boolean e a conversão é explícita: quem chamar com `false` manda um
 * pedido que o servidor **vai** recusar, que é o comportamento certo.
 *
 * O campo vai no corpo e não na query string por decisão da spec: afirmação
 * não viaja em URL, que fica em log e histórico de navegador.
 */
export async function enviarImagemDeQuadra(
  quadraId: string,
  arquivo: File,
  semPessoasIdentificaveis: boolean,
): Promise<ImagemDeQuadraResolvida> {
  const corpo = new FormData();
  // Nome do campo é contrato (CON-017.1); errar aqui dá 400, não 422.
  corpo.append("arquivo", arquivo);
  corpo.append(
    "semPessoasIdentificaveis",
    semPessoasIdentificaveis ? "true" : "false",
  );
  const res = await authFetch(`/courts/${quadraId}/imagem`, {
    method: "PUT",
    body: corpo,
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível enviar a imagem da quadra");
  }
  return (await res.json()) as ImagemDeQuadraResolvida;
}

/** AC-010 — apagar sem substituir. */
export async function removerImagemDeQuadra(
  quadraId: string,
): Promise<ImagemDeQuadraResolvida> {
  const res = await authFetch(`/courts/${quadraId}/imagem`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw await parseError(res, "Não foi possível remover a imagem da quadra");
  }
  return (await res.json()) as ImagemDeQuadraResolvida;
}

/**
 * DEF-004 — liga/desliga o auto-cadastro. A SPEC-009/REQ-006 dizia que "a
 * empresa decide" e nenhuma rota escrevia no campo: a decisão ficava
 * congelada no default.
 */
export async function definirAutoCadastro(
  permiteAutoCadastro: boolean,
): Promise<MinhaEmpresa> {
  const res = await authFetch("/me/company", {
    method: "PATCH",
    body: JSON.stringify({ permiteAutoCadastro }),
  });
  return (await res.json()) as MinhaEmpresa;
}

/**
 * SPEC-023 — quantas turmas um aluno pode entrar POR CONTA PROPRIA.
 *
 * `null` = sem limite, e e o padrao. **Vale para entrar, nunca para
 * expulsar** (INV-023a): baixar o limite nao tira ninguem de turma em que ja
 * esta — ninguem sai de uma turma porque uma configuracao mudou.
 *
 * O `PATCH` virou parcial na SPEC-023: manda-se so o campo que mudou. Antes
 * ele exigia `permiteAutoCadastro` sempre, e reenviar valor que nao se quis
 * mudar e como configuracao se perde sem ninguem perceber.
 */
export async function definirLimiteDeTurmas(
  limiteTurmasPorAluno: number | null,
): Promise<MinhaEmpresa> {
  const res = await authFetch("/me/company", {
    method: "PATCH",
    body: JSON.stringify({ limiteTurmasPorAluno }),
  });
  return (await res.json()) as MinhaEmpresa;
}

export async function getHorariosEmpresa(): Promise<HorariosEmpresa> {
  const res = await authFetch("/company-settings/horarios");
  return (await res.json()) as HorariosEmpresa;
}

export async function definirHorariosEmpresa(
  dias: DiaHorario[],
): Promise<ResultadoHorarios> {
  const res = await authFetch("/company-settings/horarios", {
    method: "PUT",
    body: JSON.stringify({ dias }),
  });
  return (await res.json()) as ResultadoHorarios;
}

/** `origem` diz se a quadra tem horário próprio ou reflete o padrão. */
export type HorariosQuadra = components["schemas"]["HorariosDaQuadraResponseDto"];

export async function getHorariosQuadra(id: string): Promise<HorariosQuadra> {
  const res = await authFetch(`/courts/${id}/horarios`);
  return (await res.json()) as HorariosQuadra;
}

export async function definirHorariosQuadra(
  id: string,
  dias: DiaHorario[],
): Promise<ResultadoHorarios> {
  const res = await authFetch(`/courts/${id}/horarios`, {
    method: "PUT",
    body: JSON.stringify({ dias }),
  });
  return (await res.json()) as ResultadoHorarios;
}

export async function removerHorariosQuadra(
  id: string,
): Promise<ResultadoHorarios> {
  const res = await authFetch(`/courts/${id}/horarios`, { method: "DELETE" });
  return (await res.json()) as ResultadoHorarios;
}

// =====================================================================
// SPEC-012 — agenda do gestor
// =====================================================================

export type DiaDaAgenda = components["schemas"]["DiaDaAgendaResponseDto"];

export type ItemDoDia = components["schemas"]["ItemDaAgendaResponseDto"];

export async function getAgendaMes(mes: string): Promise<DiaDaAgenda[]> {
  const res = await authFetch(`/agenda?mes=${mes}`);
  return (await res.json()) as DiaDaAgenda[];
}

export async function getAgendaDia(data: string): Promise<ItemDoDia[]> {
  const res = await authFetch(`/agenda/${data}`);
  return (await res.json()) as ItemDoDia[];
}

/**
 * SPEC-014:TASK-000 — troca de senha. O backend revoga todas as sessoes e
 * devolve um par novo; quem chama precisa guardar o access token, senao a
 * pessoa cai no login logo depois de trocar.
 */
export async function trocarSenha(dto: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<{ accessToken: string }> {
  const res = await authFetch("/auth/trocar-senha", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  return (await res.json()) as { accessToken: string };
}

/**
 * SPEC-014/AC-009 — histórico de presença da turma. **Só leitura**: nesta
 * spec o gestor consulta e não corrige (LIM-002). O custo está declarado —
 * se o professor sair do clube, uma chamada errada dele não tem quem
 * conserte. Se doer no uso real, vira spec, não remendo.
 */
export type OcorrenciaPresenca = components["schemas"]["OcorrenciaNoHistoricoResponseDto"];

export async function listPresencasDaTurma(
  turmaId: string,
  dias = 30,
): Promise<OcorrenciaPresenca[]> {
  const res = await authFetch(`/classes/${turmaId}/presencas?dias=${dias}`);
  return (await res.json()) as OcorrenciaPresenca[];
}

// ---------------------------------------------------------------------
// SPEC-015 — frequência (TASK-001, 002, 003)
//
// As formas abaixo são escritas à mão porque o Nest não gera schema para
// retorno de rota sem DTO de resposta, e estes três são leitura pura. O
// contrato de verdade está em `openapi.json`; se divergirem, quem manda é
// ele.
// ---------------------------------------------------------------------

/**
 * AC-013 — três números, não um. `lancadas` diz que alguém salvou algo;
 * `completas`, que a chamada cobre a turma inteira. Só a segunda sustenta
 * percentual, e é ela que decide `confianca` (AC-014).
 */
export type CoberturaFrequencia = components["schemas"]["CoberturaResponseDto"];

export type LinhaFrequencia = components["schemas"]["AlunoNaFrequenciaDaTurmaResponseDto"];

export type FrequenciaDaTurma = components["schemas"]["FrequenciaDaTurmaResponseDto"];

export type FrequenciaDoAluno = components["schemas"]["FrequenciaDoAlunoResponseDto"];

export type ItemEvasao = components["schemas"]["AlunoEmEvasaoResponseDto"];

export type ListaDeEvasao = components["schemas"]["EvasaoResponseDto"];

export async function getFrequenciaDaTurma(
  turmaId: string,
  dias = 30,
): Promise<FrequenciaDaTurma> {
  const res = await authFetch(`/classes/${turmaId}/frequencia?dias=${dias}`);
  return (await res.json()) as FrequenciaDaTurma;
}

export async function getFrequenciaDoAluno(
  alunoId: string,
  dias = 30,
): Promise<FrequenciaDoAluno> {
  const res = await authFetch(`/students/${alunoId}/frequencia?dias=${dias}`);
  return (await res.json()) as FrequenciaDoAluno;
}

export async function getEvasao(dias = 30): Promise<ListaDeEvasao> {
  const res = await authFetch(`/dashboard/evasao?dias=${dias}`);
  return (await res.json()) as ListaDeEvasao;
}
