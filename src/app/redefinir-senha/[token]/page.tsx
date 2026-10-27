import type { Metadata } from "next";
import { RedefinirSenhaForm } from "@/components/redefinir-senha-form";
import { TelaDeAcesso } from "@/components/tela-de-acesso";

/**
 * SPEC-090 (D9) — **o token está no caminho, e o caminho não sai daqui.**
 *
 * Com a política padrão do navegador, um pedido à mesma origem leva o
 * endereço inteiro no `Referer` — e o endereço inteiro é o link que redefine
 * a senha. `no-referrer` vale para o documento todo, e as duas chamadas da
 * redefinição repetem a regra no próprio `fetch` (`api-client.ts`). É a
 * primeira página do Admin com essa `metadata`: até aqui nenhuma tinha
 * credencial no endereço.
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <TelaDeAcesso
      titulo="Redefinir senha"
      descricao="Crie uma senha nova para entrar no painel."
    >
      <RedefinirSenhaForm token={token} />
    </TelaDeAcesso>
  );
}
