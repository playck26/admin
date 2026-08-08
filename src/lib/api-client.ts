import type { components } from "./api-types";
import { getAccessToken } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];
export type CreateStudentDto = components["schemas"]["CreateStudentDto"];
export type UpdateStudentDto = components["schemas"]["UpdateStudentDto"];
export type CreateTeacherDto = components["schemas"]["CreateTeacherDto"];
export type UpdateTeacherDto = components["schemas"]["UpdateTeacherDto"];
export type CreateLevelDto = components["schemas"]["CreateLevelDto"];
export type UpdateLevelDto = components["schemas"]["UpdateLevelDto"];

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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  return body && typeof body === "object" && "message" in body && typeof body.message === "string"
    ? body.message
    : fallback;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, "Não foi possível completar a operação"));
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
    throw new ApiError(res.status, await parseErrorMessage(res, "Não foi possível entrar"));
  }

  return (await res.json()) as LoginResult;
}

export async function listStudents(page = 1, pageSize = 20): Promise<Paginated<Student>> {
  const res = await authFetch(`/students?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as Paginated<Student>;
}

export async function createStudent(dto: CreateStudentDto): Promise<Student> {
  const res = await authFetch("/students", { method: "POST", body: JSON.stringify(dto) });
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
