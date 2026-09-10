import { EditStudentForm } from "@/components/edit-student-form";
import { FrequenciaAluno } from "@/components/frequencia-aluno";
import { CadastroCompletoDoAluno } from "@/components/cadastro-completo-do-aluno";
import { CarteiraDoAluno } from "@/components/carteira-do-aluno";

export default async function EditarAlunoPage({
  params,
}: PageProps<"/pessoas/alunos/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <EditStudentForm id={id} />
      {/* SPEC-036/TASK-004 — o cadastro completo fica logo depois do
          formulário principal: os dois editam a MESMA pessoa, e separá-los
          por outra seção no meio faria parecer que são fichas diferentes. */}
      <CadastroCompletoDoAluno alunoId={id} />
      {/* SPEC-015/TASK-004 — a frequência fica DEPOIS do cadastro, na mesma
          tela: quem abre a ficha do aluno costuma vir de um alerta de
          evasão, e precisa do número junto do contato para agir. */}
      <FrequenciaAluno alunoId={id} />
      {/* SPEC-033/TASK-007 — a carteira fica na ficha pelo mesmo motivo da
          frequência: quem lança crédito está olhando para uma pessoa, não
          para uma carteira. Ela vem por último porque é ação, e as duas de
          cima são leitura. */}
      <CarteiraDoAluno alunoId={id} />
    </div>
  );
}
