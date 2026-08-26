"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { comprimirImagem, LADO_MAXIMO_PX } from "@/lib/comprimir-imagem";
import {
  enviarImagemDeQuadra,
  removerImagemDeQuadra,
} from "@/lib/api-client";

/**
 * SPEC-018/TASK-005 — onde o gestor sobe a imagem da quadra.
 *
 * **O que separa esta tela da logo é a confirmação (AC-007..009).** A logo é
 * material corporativo e sobe sem pergunta. A imagem de quadra é pública,
 * permanente e pode mostrar aluno — que pode ser menor de idade. Em
 * 2026-08-23 o Israel decidiu a opção B: continua pública, e o produto
 * **exige afirmação explícita** de quem sobe.
 *
 * **A afirmação é uma caixa do produto, não um `confirm()` do navegador**
 * (AC-009). Um `confirm()` é texto do sistema operacional, não dá para ler
 * com calma, não fica na tela e some ao clicar — é o oposto do que uma
 * afirmação com consequência precisa ser.
 *
 * **E a caixa não é o gate.** O gate é o servidor (AC-007): `curl` sem o
 * campo leva 422. Esta caixa existe para que o gestor **leia** o que está
 * afirmando; se ela fosse a única barreira, seria decoração.
 *
 * **Ela reseta depois de cada envio**, e é AC-008, não detalhe de UI: a
 * confirmação vale para *aquela* imagem. Deixar marcada faria a próxima
 * troca herdar uma afirmação que ninguém fez.
 */
export function ImagemDaQuadraSection({
  quadraId,
  imagemInicial,
}: {
  quadraId: string;
  imagemInicial: string | null;
}) {
  const [imagemUrl, setImagemUrl] = useState<string | null>(imagemInicial);
  const [confirmou, setConfirmou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function escolher(arquivo: File) {
    setErro(null);
    setOcupado(true);
    try {
      const comprimida = await comprimirImagem(arquivo);
      const resultado = await enviarImagemDeQuadra(
        quadraId,
        comprimida.arquivo,
        confirmou,
      );
      setImagemUrl(resultado.imagemUrl);
      // AC-008: a próxima troca precisa de afirmação própria.
      setConfirmou(false);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível enviar a imagem."));
    } finally {
      setOcupado(false);
      // Sem isto, escolher o MESMO arquivo depois de um erro não dispara
      // `change` de novo, e a tela parece travada.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setErro(null);
    setOcupado(true);
    try {
      const resultado = await removerImagemDeQuadra(quadraId);
      setImagemUrl(resultado.imagemUrl);
      setConfirmou(false);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível remover a imagem."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
          Imagem da quadra
        </h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Aparece para o aluno na hora de escolher onde jogar.
        </p>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {imagemUrl ? (
            // Sem `next/image`: a URL é de CDN externo e o domínio teria de
            // entrar em `next.config.ts` — a planta declara que este projeto
            // não carrega otimizador para host de terceiro.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagemUrl}
              alt="Imagem da quadra"
              className="h-32 w-48 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-[var(--color-surface-container)] text-sm text-[var(--color-on-surface-variant)] ring-1 ring-border">
              Sem imagem
            </div>
          )}
          {ocupado ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
              <Loader2
                className="size-7 animate-spin text-white"
                aria-hidden="true"
              />
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {/*
            AC-009 — o aviso vem ANTES da caixa e antes do botão, e diz as
            duas coisas que a pessoa precisa saber para decidir: que é
            pública e permanente, e que não deve mostrar gente.
          */}
          <p className="max-w-md text-sm text-[var(--color-on-surface-variant)]">
            Esta imagem fica <strong>pública e permanente</strong>: qualquer
            pessoa com o link consegue abrir, mesmo sem ter conta. Suba a foto
            da quadra, <strong>não de aulas ou de pessoas</strong>.
          </p>

          <label className="flex max-w-md cursor-pointer items-start gap-2 text-sm text-[var(--color-on-surface)]">
            <input
              type="checkbox"
              checked={confirmou}
              disabled={ocupado}
              onChange={(e) => setConfirmou(e.target.checked)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Confirmo que esta imagem <strong>não mostra pessoas
              identificáveis</strong>.
            </span>
          </label>

          <input
            ref={entrada}
            type="file"
            // `image/*` e não `image/webp`: o gestor escolhe a foto do
            // celular, e a conversão é nossa.
            accept="image/*"
            className="sr-only"
            aria-label="Escolher imagem da quadra"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void escolher(arquivo);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              // Desabilitado sem a confirmação: deixar clicável e recusar no
              // servidor seria fazer a pessoa esperar o upload para ler que
              // faltou marcar uma caixa que está na frente dela.
              disabled={ocupado || !confirmou}
              onClick={() => entrada.current?.click()}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-4 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              <Camera className="size-4" aria-hidden="true" />
              {imagemUrl ? "Trocar imagem" : "Adicionar imagem"}
            </button>

            {imagemUrl ? (
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

          {!confirmou ? (
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Marque a confirmação acima para poder enviar.
            </p>
          ) : null}

          <p className="max-w-md text-xs text-[var(--color-on-surface-variant)]">
            A imagem é reduzida para no máximo {LADO_MAXIMO_PX}px antes de
            subir.
          </p>
        </div>
      </div>

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
  // tela — trocar por texto genérico esconderia justamente o erro que o
  // gestor não causou.
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}
