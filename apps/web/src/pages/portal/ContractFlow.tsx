import { contractStatusLabels } from "@mf/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useServices } from "../../app/session";
import { FaceCapture, SignaturePad } from "../../components/sign/Capture";
import { Badge, Button, Card, Empty, ErrorText, Field, PageHeader, TextInput } from "../../components/ui";
import { ClientError } from "../../services/types";

export function ContractPage() {
  const services = useServices();
  const query = useQuery({ queryKey: ["contracts", "mine"], queryFn: () => services.myContracts() });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="合約" lede="管理員發出合約後，在這裡核對內容、拍攝人像並手寫簽名。簽署完成可以下載含簽名的 PDF。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入合約"} /> : null}
      {(query.data?.length ?? 0) === 0 && !query.isLoading ? <Empty title="還沒有合約" body="管理員發出後會出現在這裡。" /> : null}
      <div className="space-y-3">
        {query.data?.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/portal/contracts/${item.id}`}>{item.contractNo}</Link>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.title}</p>
              </div>
              <Badge tone={contractStatusLabels[item.status].tone}>{contractStatusLabels[item.status].label}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ContractSignPage() {
  const { contractId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["contract", contractId], queryFn: () => services.contract(contractId), enabled: Boolean(contractId) });
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [face, setFace] = useState<Blob | null>(null);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const sign = useMutation({
    mutationFn: () => {
      const item = query.data;
      if (!item || !face || !signature) throw new ClientError("請先完成人像與簽名");
      return services.signContract(item.id, { signerName, signerTitle, expectedVersion: item.version, face, signature });
    },
    onSuccess: async () => {
      setMessage("已簽署。可以下載 PDF。");
      await client.invalidateQueries({ queryKey: ["contract", contractId] });
      await client.invalidateQueries({ queryKey: ["contracts", "mine"] });
    },
    onError: (error) => setMessage(error instanceof ClientError ? error.message : "簽署失敗"),
  });

  const item = query.data;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="線上簽署" title={item?.title ?? "合約"} lede="請核對全文。拍攝當時人像，再於下方手寫簽名。送出後會產生 PDF，這份文字就不再跟著範本改動。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "找不到合約"} /> : null}
      {item ? (
        <>
          <article className="max-w-3xl whitespace-pre-wrap border-t border-[var(--line)] pt-6 leading-8">{item.body}</article>
          <p className="text-sm text-[var(--muted)]">{item.contractNo} · {contractStatusLabels[item.status].label}</p>
          {item.status === "SIGNED" ? (
            <Button onClick={async () => downloadBlob(await services.contractDocument(item.id))}>下載已簽名 PDF</Button>
          ) : null}
          {item.status === "ISSUED" ? (
            <form
              className="max-w-3xl space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (!consent) {
                  setMessage("請先勾選已閱讀並同意簽署");
                  return;
                }
                if (!face || !signature) {
                  setMessage("請拍攝人像並留下手寫簽名");
                  return;
                }
                setMessage("");
                sign.mutate();
              }}
            >
              <Field label="簽署人姓名">
                <TextInput value={signerName} onChange={(event) => setSignerName(event.target.value)} required />
              </Field>
              <Field label="職稱">
                <TextInput value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} required />
              </Field>
              <section className="space-y-3">
                <h2 className="text-2xl">人像</h2>
                <FaceCapture onChange={setFace} />
              </section>
              <section className="space-y-3">
                <h2 className="text-2xl">手寫簽名</h2>
                <SignaturePad onChange={setSignature} />
              </section>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                我已閱讀這份合約，並同意以這次拍攝的人像與手寫簽名完成簽署。
              </label>
              <Button type="submit" disabled={sign.isPending}>{sign.isPending ? "正在產生 PDF…" : "完成簽署並產生 PDF"}</Button>
            </form>
          ) : null}
          {item.status === "VOID" ? <p>這份合約已作廢。</p> : null}
          {message ? <p className="text-sm">{message}</p> : null}
        </>
      ) : null}
    </div>
  );
}

async function downloadBlob(file: { blob: Blob; name: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
