"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Configuração de pagamento</CardTitle>
        <CardDescription>Como sua escola recebe o pagamento das reservas</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-[var(--color-text-secondary)]">Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {semNenhumMeio ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                Preencha ao menos o link de pagamento ou o WhatsApp antes de cobrar reservas.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="linkPagamentoUrl">Link de pagamento</Label>
              <Input
                id="linkPagamentoUrl"
                type="url"
                placeholder="https://pay.example.com/sua-escola"
                value={linkPagamentoUrl}
                onChange={(e) => setLinkPagamentoUrl(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsappNumero">WhatsApp</Label>
              <Input
                id="whatsappNumero"
                placeholder="+5511999999999"
                value={whatsappNumero}
                onChange={(e) => setWhatsappNumero(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-[var(--color-text-secondary)]">Formato internacional (E.164), ex. +5511999999999</p>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {error}
              </p>
            ) : saved ? (
              <p className="text-sm text-[var(--color-primary)]">Configuração salva.</p>
            ) : null}

            <Button type="submit" disabled={saving} className="mt-2">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
