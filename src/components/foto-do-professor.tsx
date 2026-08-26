"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { comprimirImagem, LADO_MAXIMO_PX } from "@/lib/comprimir-imagem";
import {
  enviarFotoDeProfessor,
  removerFotoDeProfessor,
} from "@/lib/api-client";

/**
 * SPEC-018/TASK-004 — a foto do professor, na ficha.
 *
 * **O caso que motiva a tela é o professor SEM conta**, que é o normal: o
 * clube cadastra quem dá aula sem que essa pessoa precise de login, e a foto
 * dela não teria onde morar.
 *
 * **Mas a tela também aceita professor COM conta**, e por isso ela avisa —
 * ver `avisoDaPrecedencia` abaixo. A INV-034 diz que quem tem conta manda na
 * própria imagem: se a pessoa já tiver subido a dela, a que o gestor mandar
 * fica gravada e **não aparece**. Deixar isso implícito faria o gestor achar
 * que o upload falhou.
 *
 * **A foto é PRIVADA**, ao contrário da logo e da imagem de quadra: a URL é
 * assinada e expira. A tela diz isso, porque é a diferença que decide o que
 * a pessoa se sente à vontade para subir.
 */
export function FotoDoProfessor({
  professorId,
  fotoInicial,
  temConta,
}: {
  professorId: string;
  fotoInicial: string | null;
  temConta: boolean;
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(fotoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function escolher(arquivo: File) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const comprimida = await comprimirImagem(arquivo);
      const resultado = await enviarFotoDeProfessor(
        professorId,
        comprimida.arquivo,
      );

      // **A comparação é o ponto desta tela.** Se a URL que voltou é a mesma
      // de antes, a INV-034 escolheu a foto da conta — o upload deu certo e
      // mesmo assim a tela não muda. Sem este aviso, isso lê como falha.
      if (resultado.fotoUrl === fotoUrl && temConta) {
        setAviso(
          "A foto foi salva na ficha, mas quem aparece é a que o próprio professor subiu no perfil dele — ela tem preferência.",
        );
      }
      setFotoUrl(resultado.fotoUrl);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível enviar a foto."));
    } finally {
      setOcupado(false);
      // Sem isto, escolher o MESMO arquivo depois de um erro não dispara
      // `change` de novo, e a tela parece travada.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      // Pode NÃO deixar a tela vazia: se o professor tem foto própria, ela
      // passa a aparecer. Por isso a resposta é usada, e não descartada.
      const resultado = await removerFotoDeProfessor(professorId);
      setFotoUrl(resultado.fotoUrl);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível remover a foto."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          {fotoUrl ? (
            // Sem `next/image`: a URL é assinada e muda a cada leitura, então
            // o otimizador não teria o que cachear — e o domínio teria de
            // entrar em `next.config.ts`.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt="Foto do professor"
              className="size-24 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full bg-[var(--color-surface-container)] ring-1 ring-border">
              <User
                className="size-10 text-[var(--color-on-surface-variant)]"
                aria-hidden="true"
              />
            </div>
          )}
          {ocupado ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2
                className="size-7 animate-spin text-white"
                aria-hidden="true"
              />
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={entrada}
            type="file"
            // `image/*` e não `image/webp`: o gestor escolhe a foto que tem,
            // e a conversão é nossa.
            accept="image/*"
            className="sr-only"
            aria-label="Escolher foto do professor"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void escolher(arquivo);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => entrada.current?.click()}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-4 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              <Camera className="size-4" aria-hidden="true" />
              {fotoUrl ? "Trocar foto" : "Adicionar foto"}
            </button>
            {fotoUrl ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void remover()}
                className="flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[var(--color-on-surface-variant)] ring-1 ring-border transition-colors hover:text-[var(--color-primary-strong)] disabled:opacity-60"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remover
              </button>
            ) : null}
          </div>

          <p className="max-w-md text-xs text-[var(--color-on-surface-variant)]">
            A imagem é reduzida para no máximo {LADO_MAXIMO_PX}px antes de
            subir. <strong>Ela é privada</strong> — só quem está logado no
            painel a vê.
          </p>

          {temConta ? (
            <p className="max-w-md text-xs text-[var(--color-on-surface-variant)]">
              Este professor tem login. Se ele subir uma foto no perfil dele,
              <strong> a dele passa a aparecer no lugar desta</strong>.
            </p>
          ) : null}
        </div>
      </div>

      {aviso ? (
        <p
          role="status"
          className="text-sm text-[var(--color-on-surface-variant)]"
        >
          {aviso}
        </p>
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="text-sm font-semibold text-[var(--color-error)]"
        >
          {erro}
        </p>
      ) : null}
    </section>
  );
}

function mensagem(erro: unknown, padrao: string): string {
  // A mensagem do `ErroDeCompressao` é texto de produto e chega inteira à
  // tela — trocar por texto genérico esconderia o erro que o gestor não
  // causou.
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}
