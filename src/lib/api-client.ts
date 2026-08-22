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

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nome: string;
    role: "super_admin" | "company_admin" | "aluno";
    companyId: string | null;
  };
}

export interface Student {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  nivelId: string | null;
  status: "ativo" | "inativo";
  /** SPEC-009/REQ-008: se a empresa já reconhece esta pessoa como aluna. */
  vinculo?: "pendente" | "aprovado" | "recusado";
}

/**
 * SPEC-009/AC-006 — a senha temporária vem **uma única vez**, na resposta
 * que a criou. Nenhuma outra rota a devolve, então a tela precisa mostrá-la
 * no ato: se o admin fechar sem copiar, o caminho é gerar outra.
 */
export interface StudentComSenha extends Student {
  senhaTemporaria: string;
}

export interface Teacher {
  id: string;
  companyId: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: "ativo" | "inativo";
  createdAt: string;
}

export interface Level {
  id: string;
  companyId: string;
  nome: string;
  ordem: number;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Court {
  id: string;
  companyId: string;
  nome: string;
  esporte: string;
  precoHora: number;
  status: "ativa" | "inativa";
  createdAt: string;
}

export interface AvailabilitySlot {
  slot: string;
  status: "livre" | "ocupado_turma" | "ocupado_avulso";
}

export interface Availability {
  quadraId: string;
  data: string;
  slots: AvailabilitySlot[];
}

export interface Booking {
  id: string;
  companyId: string;
  quadraId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  origemTipo: "TURMA" | "AVULSO";
  alunoId: string | null;
  statusPagamento: "pendente_pagamento" | "pago" | "cancelado";
}

export interface BookingConflictInfo {
  ocupacaoId: string;
  origemTipo: string;
}

export interface PaymentConfig {
  companyId: string;
  linkPagamentoUrl: string | null;
  whatsappNumero: string | null;
}

export interface SchoolClass {
  id: string;
  companyId: string;
  nome: string;
  nivelId: string | null;
  professorId: string | null;
  quadraId: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  capacidade: number;
  status: "ativa" | "inativa";
  alunosAlocados: number;
}

export interface SchoolClassStudent {
  alunoId: string;
  nome: string;
  email: string;
}

export interface SchoolClassDetail extends SchoolClass {
  alunos: SchoolClassStudent[];
}

export interface DashboardSummary {
  alunosAtivos: number;
  ocupacaoTurmasPct: number;
  ocupacaoQuadrasPct: number;
}

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

async function requisicaoAutenticada(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = getAccessToken();
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
export interface ConviteCriado {
  id: string;
  token: string;
  expiraEm: string;
}

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

export async function createBooking(dto: CreateBookingDto): Promise<Booking> {
  const res = await authFetch("/bookings", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as Booking;
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
