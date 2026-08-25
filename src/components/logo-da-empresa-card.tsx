"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import { comprimirImagem, LADO_MAXIMO_PX } from "@/lib/comprimir-imagem";
import {
  enviarLogo,
  getMinhaEmpresa,
  removerLogo,
  type MinhaEmpresa,
} from "@/lib/api-client";

/**
 * SPEC-018/TASK-006 — onde o gestor sobe a marca da arena.
 *
 * **Fica em Configurações**, junto do horário de funcionamento e do link de
 * cadastro: é a tela das coisas que valem para a empresa inteira, e a logo é
 * a mais visível delas.
 *
 * **A logo é PÚBLICA e permanente**, e a tela diz isso antes do envio. É a
 * diferença que mais importa em relação à foto de perfil: aquela é privada e
 * a URL expira; esta vai para o CDN e qualquer pessoa com o link a abre —
 * inclusive quem ainda não é aluno, na página de cadastro.
 */
export function LogoDaEmpresaCard() {
  const [empresa, setEmpresa] = useState<MinhaEmpresa | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    getMinhaEmpresa()
      .then((e) => {
        if (!vivo) return;
        setEmpresa(e);
        setLogoUrl(e.logoUrl);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(mensagem(e, "Não foi possível carregar a empresa."));
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function escolher(arquivo: File) {
    if (!empresa) return;
    setErro(null);
    setOcupado(true);
    try {
      const comprimida = await comprimirImagem(arquivo);
      const resultado = await enviarLogo(empresa.id, comprimida.arquivo);
      setLogoUrl(resultado.logoUrl);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível enviar a logo."));
    } finally {
      setOcupado(false);
      // Sem isto, escolher o MESMO arquivo depois de um erro não dispara
      // `change` de novo, e a tela parece travada.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    if (!empresa) return;
    setErro(null);
    setOcupado(true);
    try {
      // Pode não deixar a tela vazia: se havia URL externa, ela volta a
      // valer (AC-013). Por isso a resposta é usada, e não descartada.
      const resultado = await removerLogo(empresa.id);
      setLogoUrl(resultado.logoUrl);
    } catch (e: unknown) {
      setErro(mensagem(e, "Não foi possível remover a logo."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-border">
      <header className="mb-4">
        <h2 className="text-lg font-extrabold text-[var(--color-primary-strong)]">
          Logo da arena
        </h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Aparece no painel, no app do aluno e na página pública de cadastro.
        </p>
      </header>

      <div className="flex items-center gap-5">
        <div className="relative">
          <LogoDaEmpresa
            url={logoUrl}
            nome={empresa?.nome}
            className="size-24"
          />
          {ocupado ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
              <Loader2 className="size-7 animate-spin text-white" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={entrada}
            type="file"
            // `image/*` e não `image/webp`: o gestor escolhe o PNG que o
            // designer mandou, e a conversão é nossa. Filtrar por WebP aqui
            // deixaria a pasta dele vazia.
            accept="image/*"
            className="sr-only"
            aria-label="Escolher logo da arena"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void escolher(arquivo);
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={ocupado || !empresa}
              onClick={() => entrada.current?.click()}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-4 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              <Camera className="size-4" aria-hidden="true" />
              {logoUrl ? "Trocar logo" : "Adicionar logo"}
            </button>
            {logoUrl ? (
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
          <p className="max-w-sm text-xs text-[var(--color-on-surface-variant)]">
            A imagem é reduzida para no máximo {LADO_MAXIMO_PX}px antes de
            subir. <strong>Ela fica pública</strong> — qualquer pessoa com o
            link consegue abrir.
          </p>
        </div>
      </div>

      {erro ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

function mensagem(erro: unknown, padrao: string): string {
  // A mensagem do `ErroDeCompressao` é texto de produto — inclusive a do
  // aparelho com tela Display P3 (INV-050), que é o caso mais difícil de
  // diagnosticar depois. Trocar por texto genérico esconderia justamente o
  // erro que o gestor não causou.
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}
