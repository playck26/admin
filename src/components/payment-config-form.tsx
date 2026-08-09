"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Link2, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormCard } from "@/components/form-card";
import { ApiError, getPaymentConfig, updatePaymentConfig } from "@/lib/api-client";

// REQ-001 (SPEC-006): admin configura link de pagamento e/ou WhatsApp da
// própria empresa. Regra de produto (não bloqueio de banco,
// DATA_MODEL.md): pelo menos um dos dois precisa estar preenchido antes
// da empresa "operar" com cobrança — mostrado como aviso, não erro.
export function PaymentConfigForm() {
  const [linkPagamentoUrl, setLinkPagamentoUrl] = useState("");
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPaymentConfig()
      .then((config) => {
        setLinkPagamentoUrl(config.linkPagamentoUrl ?? "");
        setWhatsappNumero(config.whatsappNumero ?? "");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a configuração.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const config = await updatePaymentConfig({
        linkPagamentoUrl: linkPagamentoUrl || undefined,
        whatsappNumero: whatsappNumero || undefined,
      });
      setLinkPagamentoUrl(config.linkPagamentoUrl ?? "");
      setWhatsappNumero(config.whatsappNumero ?? "");
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  const semNenhumMeio = !loading && !linkPagamentoUrl && !whatsappNumero;

  return (
    <FormCard title="Configuração de pagamento" description="Como sua escola recebe o pagamento das reservas" className="max-w-2xl">
      {loading ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          {semNenhumMeio ? (
            <div role="alert" className="flex gap-3 rounded-r-lg border-l-4 border-[var(--color-error)] bg-[var(--color-error-container)]/40 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--color-error)]" />
              <div>
                <p className="text-sm font-medium text-[var(--color-error)]">Atenção necessária</p>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                  Preencha ao menos o link de pagamento ou o WhatsApp antes de cobrar reservas.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="linkPagamentoUrl">Link de pagamento</Label>
            <div className="relative">
              <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-outline)]" />
              <Input
                id="linkPagamentoUrl"
                type="url"
                placeholder="https://pay.example.com/sua-escola"
                value={linkPagamentoUrl}
                onChange={(e) => setLinkPagamentoUrl(e.target.value)}
                disabled={saving}
                className="h-11 pr-4 pl-10"
              />
            </div>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Os alunos serão redirecionados para este link para concluir o pagamento.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsappNumero">WhatsApp para cobrança</Label>
            <div className="relative">
              <MessageCircle className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-outline)]" />
              <Input
                id="whatsappNumero"
                placeholder="+5511999999999"
                value={whatsappNumero}
                onChange={(e) => setWhatsappNumero(e.target.value)}
                disabled={saving}
                className="h-11 pr-4 pl-10"
              />
            </div>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Formato internacional recomendado (+55 DDD NÚMERO).
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : saved ? (
            <p className="text-sm text-primary">Configuração salva.</p>
          ) : null}

          <div className="flex justify-end gap-4 border-t border-border pt-6">
            <Button type="submit" disabled={saving} className="h-11 gap-2 px-6 text-[13px] font-semibold">
              <Save className="size-[18px]" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </FormCard>
  );
}
