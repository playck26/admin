"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  atualizarPlano,
  criarPlano,
  listarPlanos,
  type Plano,
} from "@/lib/api-client";

/**
 * SPEC-037/REQ-001 — os planos que o clube vende.
 *
 * ## Não há botão de apagar, e a ausência é a decisão (INV-115)
 *
 * Plano contratado carrega história: apagar quebraria a FK `RESTRICT` de
 * `matriculas` com `23503`. **"Desativar" é a única forma**, e ela nunca perde
 * dado — duas maneiras de "sumir com o plano" fariam o gestor escolher entre
 * elas sem saber a diferença.
 *
 * ## O link herdado precisa aparecer COMO herdado
 *
 * `linkHerdado: true` significa "este plano usa o link do clube". Sem mostrar
 * isso, o gestor não distinguiria um plano configurado de um que só segue o
 * padrão — e mudar o link da empresa alteraria, em silêncio, planos que ele
 * achava próprios.
 *
 * ## Editar o preço NÃO mexe em matrícula nenhuma
 *
 * A matrícula congelou valor e prazo no dia da contratação (SPEC-037/D1), o
 * mesmo padrão de `ocupacoes_quadra.valor`. A tela diz isso, porque a dúvida
 * *"vou reajustar o preço de quem já assinou?"* é a primeira que aparece.
 */
function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PlanosCard() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("1");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarPlanos()
      .then((lista) => {
        if (!vivo) return;
        setPlanos(lista);
        setCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErro("Não foi possível carregar os planos.");
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const novo = await criarPlano({
        nome,
        // O gestor digita em reais; o contrato é em centavos, como a
        // carteira. `Math.round` porque `29.9 * 100` é `2989.99…` em ponto
        // flutuante — e um centavo perdido por plano vira erro de conta.
        valorCentavos: Math.round(Number(valor) * 100),
        prazoMeses: Number(prazo),
        linkPagamentoUrl: link.trim() === "" ? null : link.trim(),
      });
      setPlanos((atuais) => [...atuais, novo]);
      setNome("");
      setValor("");
      setPrazo("1");
      setLink("");
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível criar o plano.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(plano: Plano) {
    setErro(null);
    try {
      const atualizado = await atualizarPlano(plano.id, {
        ativo: !plano.ativo,
      });
      setPlanos((atuais) =>
        atuais.map((p) => (p.id === plano.id ? atualizado : p)),
      );
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível mudar o plano.",
      );
    }
  }

  const podeAdicionar =
    nome.trim() !== "" && valor !== "" && Number(valor) >= 0;

  return (
    <FormCard
      title="Planos"
      description="O que o clube vende. Editar o preço vale para quem matricular a partir de agora — quem já assinou fica com o valor que contratou."
    >
      {erro ? (
        <p
          role="alert"
          className="pb-3 text-sm font-semibold text-[var(--color-error)]"
        >
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Carregando...
        </p>
      ) : planos.length === 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Nenhum plano cadastrado ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {planos.map((plano) => (
            <li
              key={plano.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <span className="text-sm font-semibold">{plano.nome}</span>
              <span className="text-sm">{emReais(plano.valorCentavos)}</span>
              <span className="text-xs text-[var(--color-on-surface-variant)]">
                {plano.prazoMeses === 1 ? "1 mês" : `${plano.prazoMeses} meses`}
              </span>
              {plano.linkHerdado ? (
                <span className="text-xs text-[var(--color-on-surface-variant)]">
                  {/* Sem isto, o gestor não distinguiria um plano configurado
                      de um que só segue o padrão do clube. */}
                  link do clube
                </span>
              ) : (
                <span className="text-xs text-[var(--color-primary)]">
                  link próprio
                </span>
              )}
              <StatusBadge
                ativo={plano.ativo}
                activeLabel="Ativo"
                inactiveLabel="Inativo"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void alternar(plano)}
                className="ml-auto h-8 px-3 text-[12px] font-semibold"
              >
                {/* Nunca "Excluir": plano contratado carrega história, e a
                    FK `RESTRICT` recusaria com `23503`. */}
                {plano.ativo ? "Desativar" : "Reativar"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => void adicionar(e)}
        className="flex flex-col gap-4 border-t border-border pt-4"
      >
        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-40 flex-1 flex-col gap-2">
            <Label htmlFor="plano-nome">Nome</Label>
            <Input
              id="plano-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Mensal"
              disabled={salvando}
              className="h-10 px-3"
            />
          </div>
          <div className="flex w-36 flex-col gap-2">
            <Label htmlFor="plano-valor">Valor (R$)</Label>
            <Input
              id="plano-valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
          </div>
          <div className="flex w-32 flex-col gap-2">
            <Label htmlFor="plano-prazo">Prazo (meses)</Label>
            <Input
              id="plano-prazo"
              type="number"
              min="1"
              max="60"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="plano-link">Link de pagamento (opcional)</Label>
          <Input
            id="plano-link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            disabled={salvando}
            className="h-10 px-3"
          />
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Em branco, o plano usa o link de pagamento do clube — e acompanha as
            mudanças dele.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={salvando || !podeAdicionar}
            className="h-10 px-5 text-[13px] font-semibold"
          >
            {salvando ? "Criando..." : "Criar plano"}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}
