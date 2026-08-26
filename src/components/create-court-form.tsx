"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { SeletorDeCatalogo } from "@/components/seletor-de-catalogo";
import { ApiError, createCourt } from "@/lib/api-client";

export function CreateCourtForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  // SPEC-020/TASK-005 — eram texto livre. Agora são ids de catálogo.
  const [esporteId, setEsporteId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [precoHora, setPrecoHora] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCourt({
        nome,
        esporteId,
        // String vazia é "não escolhi", e o servidor espera o campo ausente
        // — mandar `""` num campo `uuid` daria 400 por formato.
        ...(categoriaId === "" ? {} : { categoriaId }),
        precoHora: Number(precoHora),
      });
      router.push("/quadras");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a quadra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCard title="Nova quadra" description="Preço estático por hora (sem variação por horário/dia no MVP)">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            placeholder="Quadra 1"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <SeletorDeCatalogo
          catalogo="court-sports"
          id="esporte"
          rotulo="Esporte"
          valor={esporteId}
          onChange={setEsporteId}
          obrigatorio
          desabilitado={loading}
        />
        <SeletorDeCatalogo
          catalogo="court-categories"
          id="categoria"
          rotulo="Categoria de piso (opcional)"
          valor={categoriaId}
          onChange={setCategoriaId}
          desabilitado={loading}
          opcaoVazia="Sem categoria"
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="precoHora">Preço por hora (R$)</Label>
          <Input
            id="precoHora"
            type="number"
            min="0"
            step="0.01"
            required
            value={precoHora}
            onChange={(e) => setPrecoHora(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        <FormActions
          submitLabel="Criar quadra"
          loadingLabel="Criando..."
          loading={loading}
          onCancel={() => router.push("/quadras")}
        />
      </form>
    </FormCard>
  );
}
