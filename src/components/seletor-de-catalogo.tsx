"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarCatalogo,
  type CatalogoDeQuadra,
  type OpcaoDeQuadra,
} from "@/lib/api-client";

/**
 * SPEC-020/TASK-005 — o campo que escolhe uma opção de catálogo.
 *
 * **Substitui o `<Input>` de texto livre do esporte**, que era a origem do
 * defeito inteiro desta spec: a barra de filtro do app do aluno era montada
 * com os valores distintos digitados aqui, então "Tênis" e "tenis" viravam
 * dois filtros.
 *
 * ## O estado vazio é a parte que importa
 *
 * Um `<select>` sem opções é um beco: a pessoa vem cadastrar a primeira
 * quadra do clube, não encontra nada, e não tem como saber que precisa
 * cadastrar o catálogo antes. Por isso, quando a lista volta vazia, o campo
 * vira um **link para a tela de catálogos** em vez de um seletor mudo.
 */
export function SeletorDeCatalogo({
  catalogo,
  id,
  rotulo,
  valor,
  onChange,
  obrigatorio,
  desabilitado,
  opcaoVazia,
}: {
  catalogo: CatalogoDeQuadra;
  id: string;
  rotulo: string;
  valor: string;
  onChange: (id: string) => void;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  /** Texto da opção "nenhuma" — só faz sentido em campo opcional. */
  opcaoVazia?: string;
}) {
  const [opcoes, setOpcoes] = useState<OpcaoDeQuadra[] | null>(null);

  useEffect(() => {
    let vivo = true;
    listarCatalogo(catalogo)
      .then((lista) => {
        if (vivo) setOpcoes(lista);
      })
      .catch(() => {
        // Lista vazia é indistinguível de falha de rede aqui, e é de
        // propósito: os dois levam ao mesmo lugar — o gestor precisa abrir a
        // tela de catálogos. Um alarme separado não mudaria o que ele faz.
        if (vivo) setOpcoes([]);
      });
    return () => {
      vivo = false;
    };
  }, [catalogo]);

  const carregando = opcoes === null;
  const vazio = opcoes !== null && opcoes.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>

      {vazio ? (
        <p className="rounded-lg bg-[var(--color-surface-container)] px-4 py-3 text-sm text-[var(--color-on-surface-variant)]">
          Nenhuma opção cadastrada.{" "}
          <Link
            href="/quadras/catalogos"
            className="font-bold text-[var(--color-primary-strong)] underline"
          >
            Cadastre a primeira
          </Link>{" "}
          para poder escolher aqui.
        </p>
      ) : (
        <Select
          value={valor}
          onValueChange={onChange}
          disabled={desabilitado || carregando}
          required={obrigatorio}
        >
          <SelectTrigger id={id} className="h-11">
            <SelectValue
              placeholder={carregando ? "Carregando..." : "Escolha uma opção"}
            />
          </SelectTrigger>
          <SelectContent>
            {opcaoVazia === undefined ? null : (
              <SelectItem value="">{opcaoVazia}</SelectItem>
            )}
            {(opcoes ?? []).map((opcao) => (
              <SelectItem key={opcao.id} value={opcao.id}>
                {opcao.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
