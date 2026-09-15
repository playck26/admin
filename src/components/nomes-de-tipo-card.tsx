"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormCard } from "@/components/form-card";
import { ApiError, definirNomesDeTipo, lerNomesDeTipo } from "@/lib/api-client";

const PADRAO = { quadra: "Quadra", aula: "Aula particular" } as const;

/**
 * SPEC-054/D1 — **o nome que o aluno lê** para os dois tipos fixos.
 *
 * O gestor dá nome; não inventa regra. **Campo vazio é o nome padrão**, e é
 * enviado como `null` — gravar "Quadra" como texto faria o clube perder o padrão
 * sem perceber, se um dia o padrão mudasse. Por isso o padrão aparece como
 * sugestão (`placeholder`), não como valor.
 *
 * Os dois campos vão SEMPRE no corpo: é o que o servidor exige, para "mandei só
 * um" não ser ambíguo.
 */
export function NomesDeTipoCard() {
  const [quadra, setQuadra] = useState("");
  const [aula, setAula] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    lerNomesDeTipo()
      .then((n) => {
        if (!vivo) return;
        setQuadra(n.nomeTipoQuadra === PADRAO.quadra ? "" : n.nomeTipoQuadra);
        setAula(n.nomeTipoAula === PADRAO.aula ? "" : n.nomeTipoAula);
        setCarregado(true);
      })
      .catch(() => {
        if (vivo) setMensagem({ tipo: "erro", texto: "Não foi possível carregar os nomes." });
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagem(null);
    setSalvando(true);
    try {
      await definirNomesDeTipo({
        nomeTipoQuadra: quadra.trim() === "" ? null : quadra.trim(),
        nomeTipoAula: aula.trim() === "" ? null : aula.trim(),
      });
      setMensagem({ tipo: "ok", texto: "Nomes salvos. O app do aluno já mostra assim." });
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof ApiError ? e.message : "Não foi possível salvar os nomes.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <FormCard
      title="Nomes para o cliente"
      description="Como o aluno vê as duas formas de reservar. Deixe em branco para usar o nome padrão."
    >
      <form onSubmit={(e) => void salvar(e)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome-tipo-quadra">Nome para Quadra</Label>
          <Input
            id="nome-tipo-quadra"
            maxLength={30}
            value={quadra}
            placeholder={PADRAO.quadra}
            onChange={(e) => setQuadra(e.target.value)}
            disabled={!carregado || salvando}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome-tipo-aula">Nome para Aula particular</Label>
          <Input
            id="nome-tipo-aula"
            maxLength={30}
            value={aula}
            placeholder={PADRAO.aula}
            onChange={(e) => setAula(e.target.value)}
            disabled={!carregado || salvando}
            className="h-11 px-4"
          />
        </div>
        <Button type="submit" className="h-11" disabled={!carregado || salvando}>
          {salvando ? "Salvando..." : "Salvar nomes"}
        </Button>
      </form>
      {mensagem ? (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={`mt-3 text-sm font-semibold ${
            mensagem.tipo === "erro" ? "text-[var(--color-error)]" : "text-[var(--color-primary-strong)]"
          }`}
        >
          {mensagem.texto}
        </p>
      ) : null}
    </FormCard>
  );
}
