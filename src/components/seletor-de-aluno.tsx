"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listStudents, type Student } from "@/lib/api-client";

/**
 * SPEC-049/REQ-002 — **o seletor de aluno que alcança além do centésimo.**
 *
 * ## O que ele substitui
 *
 * Quatro telas faziam `listStudents(1, 100)` e enchiam um `<select>`. O servidor
 * limita `pageSize` a `@Max(100)`, então **não havia como trazer mais**: com 101
 * alunos, o aluno 101 não existia para o gestor — a lista simplesmente
 * terminava, sem busca e sem aviso.
 *
 * ## Um componente, e não quatro cópias
 *
 * As quatro telas fariam a mesma coisa, e a primeira a divergir seria a que
 * ninguém olha. É a mesma razão que tirou a mecânica das abas de dentro de
 * `reservas-tabs` na SPEC-023.
 *
 * ## O escolhido NÃO some quando a busca muda (AC-007)
 *
 * É a armadilha deste tipo de campo: o gestor escolhe "Ana", digita "jo" para
 * conferir outra coisa, e a escolha some porque "Ana" não está mais no
 * resultado. Aqui o nome do escolhido é **guardado**, não derivado da lista —
 * e por isso sobrevive a qualquer busca seguinte.
 */
export function SeletorDeAluno({
  id,
  label = "Aluno",
  valor,
  onEscolher,
  disabled,
  obrigatorio,
  excluir,
}: {
  id: string;
  label?: string;
  valor: string;
  onEscolher: (alunoId: string, nome: string) => void;
  disabled?: boolean;
  obrigatorio?: boolean;
  /**
   * Ids que **não** devem ser oferecidos — quem já está na turma, por exemplo.
   *
   * O recorte é no cliente de propósito: é uma lista curta (a capacidade de uma
   * turma), e mandá-la ao servidor seria uma query por id para resolver algo
   * que a tela já sabe. *O que NÃO pode ser no cliente é a busca* — essa é a
   * lição desta spec.
   */
  excluir?: string[];
}) {
  const [busca, setBusca] = useState("");
  const [alunos, setAlunos] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  /**
   * O nome do escolhido, guardado **fora** da lista. Ver AC-007 acima: derivar
   * de `alunos` faria a escolha sumir na busca seguinte.
   */
  const [escolhido, setEscolhido] = useState<{ id: string; nome: string } | null>(
    null,
  );

  const pedido = useRef(0);

  useEffect(() => {
    // **Espera 300 ms depois da última tecla.** Sem isto, "joaquim" dispara
    // sete requisições e a resposta da terceira pode chegar depois da sétima.
    const timer = setTimeout(() => {
      const meu = ++pedido.current;
      setCarregando(true);
      listStudents(1, 20, busca)
        .then((r) => {
          // **Resposta atrasada não pinta a tela.** Duas buscas em voo voltam
          // fora de ordem, e sem este porteiro a lista mostraria o resultado
          // do que o gestor já apagou.
          if (meu !== pedido.current) return;
          setAlunos(r.data);
          setTotal(r.total);
        })
        .catch(() => undefined)
        .finally(() => {
          if (meu === pedido.current) setCarregando(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const oferecidos = excluir?.length
    ? alunos.filter((a) => !excluir.includes(a.id))
    : alunos;
  const naLista = oferecidos.some((a) => a.id === valor);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      <Input
        id={`${id}-busca`}
        type="search"
        placeholder="Buscar pelo nome..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        disabled={disabled}
        className="h-10 px-3"
        aria-label={`Buscar ${label.toLowerCase()} pelo nome`}
      />

      <select
        id={id}
        required={obrigatorio}
        value={valor}
        onChange={(e) => {
          const achado = alunos.find((a) => a.id === e.target.value);
          if (achado) setEscolhido({ id: achado.id, nome: achado.nome });
          onEscolher(e.target.value, achado?.nome ?? "");
        }}
        disabled={disabled}
        className="h-10 rounded-lg border border-border bg-[var(--color-surface)] px-3"
      >
        <option value="">Selecione…</option>
        {/*
          AC-007 — o escolhido entra na lista mesmo fora do resultado da busca
          atual. Sem esta linha, digitar no campo apagaria a escolha feita, e o
          `<select>` cairia para "Selecione…" sozinho.
        */}
        {escolhido && escolhido.id === valor && !naLista ? (
          <option value={escolhido.id}>{escolhido.nome}</option>
        ) : null}
        {oferecidos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>

      <p className="text-xs text-[var(--color-on-surface-variant)]">
        {carregando
          ? "Buscando..."
          : total > oferecidos.length
            ? /*
                **Diz o total, e diz que há mais.** O defeito que esta spec
                conserta era exatamente um número que mentia — repeti-lo aqui
                seria consertar num lugar e recriar no outro.
              */
              `Mostrando ${oferecidos.length} de ${total}. Refine a busca para achar quem falta.`
            : /*
                LIM-049a — a busca não ignora acento, e o contorno cabe numa
                frase. Ensinar aqui é mais barato que o gestor concluir que o
                aluno não existe.
              */
              "Digite parte do nome. Sem acento não encontra: use “jo” para “João”."}
      </p>
    </div>
  );
}
