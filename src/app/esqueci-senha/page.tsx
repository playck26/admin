import { EsqueciSenhaForm } from "@/components/esqueci-senha-form";
import { TelaDeAcesso } from "@/components/tela-de-acesso";

/**
 * SPEC-090 (D9) — **pedir o link para redefinir a senha.** Aonde o
 * "Esqueceu a senha?" do login leva. A resposta é sempre a mesma frase, com
 * conta ou sem conta (D1).
 */
export default function EsqueciSenhaPage() {
  return (
    <TelaDeAcesso
      titulo="Esqueceu a senha?"
      descricao="Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova."
    >
      <EsqueciSenhaForm />
    </TelaDeAcesso>
  );
}
