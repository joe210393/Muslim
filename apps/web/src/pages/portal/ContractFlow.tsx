import { CONTRACT_RENEWAL_WINDOW_DAYS, contractPortalTabs, contractStatusLabels, daysUntilContractExpiry, ensureContractHtml, isContractRenewalDue, portalContractStatusLabel } from "@mf/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useServices } from "../../app/session";
import { PartySealOverlays } from "../../components/PartySealOverlays";
import { Badge, Button, Empty, ErrorText, Modal, PageHeader } from "../../components/ui";
import { formatTaipei } from "../../lib/format";
import { ClientError } from "../../services/types";

type PortalContractTab = (typeof contractPortalTabs)[number]["id"];

export function ContractPage() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = contractPortalTabs.some((item) => item.id === requested) ? (requested as PortalContractTab) : null;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["contracts", "mine"], queryFn: () => services.myContracts() });
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const reminderDays = setting.data?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const all = query.data ?? [];
  const counts = {
    pending: all.filter((item) => item.status === "ISSUED").length,
    signed: all.filter((item) => item.status === "SIGNED" || item.status === "RENEWED").length,
    renewable: all.filter((item) => item.status === "SIGNED" && isContractRenewalDue(item.signedAt, new Date(), reminderDays)).length,
    not_renewed: all.filter((item) => item.status === "NOT_RENEWED").length,
  };
  const rows = tab
    ? all.filter((item) => {
        if (tab === "pending") return item.status === "ISSUED";
        if (tab === "signed") return item.status === "SIGNED" || item.status === "RENEWED";
        if (tab === "renewable") return item.status === "SIGNED" && isContractRenewalDue(item.signedAt, new Date(), reminderDays);
        if (tab === "not_renewed") return item.status === "NOT_RENEWED";
        return false;
      })
    : [];
  const tabLabel = contractPortalTabs.find((item) => item.id === tab)?.label ?? "合約";
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="業者會員區" title="合約" lede="指揮台：先看各狀態筆數，點上方塊後才展開列表。未簽訂請下載 PDF 蓋章後上傳。" />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入合約"} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {contractPortalTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-lg border p-4 text-left transition ${tab === item.id ? "border-[var(--accent-deep)] bg-[#0e6b3a]/12" : "border-[var(--line)] bg-[var(--surface)]"}`}
            onClick={() => {
              setPreviewId(null);
              setParams({ tab: item.id });
            }}
          >
            <p className="text-sm text-[var(--muted)]">{item.label}</p>
            <p className="mt-1 text-3xl font-semibold">{counts[item.id]}</p>
          </button>
        ))}
      </div>
      {!tab ? (
        <p className="text-sm text-[var(--muted)]">請點上方狀態方塊，展開未簽訂、已簽、可續約或未續約列表。</p>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">
            {tab === "pending" ? "請下載 PDF、蓋上大小章後上傳。" : null}
            {tab === "signed" ? "已簽約以實際上傳 PDF 當日為簽約日期。" : null}
            {tab === "renewable" ? "效期剩餘約兩個月內，可登記續約或未續約。" : null}
            {tab === "not_renewed" ? "已登記為未續約的合約。" : null}
          </p>
          {rows.length === 0 && !query.isLoading ? (
            <Empty title={`沒有${tabLabel}的合約`} body="換上方的狀態，或等管理員發出新合約。" />
          ) : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="p-3 font-medium">合約編號</th>
                    <th className="p-3 font-medium">標題</th>
                    <th className="p-3 font-medium">狀態</th>
                    <th className="p-3 font-medium">{tab === "pending" ? "發出時間" : "簽約日期"}</th>
                    {tab === "renewable" ? <th className="p-3 font-medium">剩餘天數</th> : null}
                    <th className="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--line)]">
                      <td className="p-3 font-medium">{item.contractNo}</td>
                      <td className="p-3">{item.title}</td>
                      <td className="p-3">
                        <Badge tone={contractStatusLabels[item.status].tone}>{portalContractStatusLabel(item.status)}</Badge>
                      </td>
                      <td className="p-3">
                        {tab === "pending"
                          ? formatTaipei(item.createdAt)
                          : item.signedAt
                            ? formatSignedDate(item.signedAt)
                            : "—"}
                      </td>
                      {tab === "renewable" ? (
                        <td className="p-3">{item.signedAt ? `約 ${daysUntilContractExpiry(item.signedAt)} 天` : "—"}</td>
                      ) : null}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-3">
                          <button type="button" className="text-[var(--link)] underline" onClick={() => setPreviewId(item.id)}>
                            預覽
                          </button>
                          <Link className="text-[var(--link)] underline" to={`/portal/contracts/${item.id}`}>
                            開啟
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
      {previewId ? <PortalContractPreviewModal contractId={previewId} onClose={() => setPreviewId(null)} /> : null}
    </div>
  );
}

function PortalContractPreviewModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const services = useServices();
  const detail = useQuery({ queryKey: ["contract", contractId], queryFn: () => services.contract(contractId) });
  const item = detail.data;
  return (
    <Modal title={item ? `預覽 ${item.contractNo}` : "預覽合約"} onClose={onClose} wide>
      {detail.isLoading ? <p>載入中…</p> : null}
      {detail.error ? <ErrorText message={detail.error instanceof ClientError ? detail.error.message : "找不到合約"} /> : null}
      {item ? (
        <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-3">
            <Button onClick={async () => downloadBlob(await services.contractDocument(item.id))}>
              {item.hasPdf ? "下載已上傳 PDF" : "下載 PDF"}
            </Button>
            <Link to={`/portal/contracts/${item.id}`} className="btn rounded-md px-3 py-2 text-sm no-underline" onClick={onClose}>
              開啟完整頁
            </Link>
          </div>
          {item.hasPdf ? <ContractPdfViewer contractId={item.id} /> : <ContractBodyViewWithSeals body={item.body} />}
        </div>
      ) : null}
    </Modal>
  );
}

export function ContractSignPage() {
  const { contractId = "" } = useParams();
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["contract", contractId], queryFn: () => services.contract(contractId), enabled: Boolean(contractId) });
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const reminderDays = setting.data?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const seals = useQuery({ queryKey: ["contract-seals"], queryFn: () => services.contractSeals() });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = useMutation({
    mutationFn: (pdf: Blob) => {
      const item = query.data;
      if (!item) throw new ClientError("找不到合約");
      return services.uploadSignedContract(item.id, { expectedVersion: item.version, pdf });
    },
    onSuccess: async () => {
      setMessage("已上傳蓋章 PDF。");
      await client.invalidateQueries({ queryKey: ["contract", contractId] });
      await client.invalidateQueries({ queryKey: ["contracts", "mine"] });
    },
    onError: (error) => setMessage(error instanceof ClientError ? error.message : "上傳失敗"),
  });

  const item = query.data;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="合約" title={item?.title ?? "合約"} lede="先下載 PDF，蓋上公司大章與負責人小章後，再上傳同一份 PDF。" />
      <Link to="/portal/contracts" className="text-sm text-[var(--link)] underline">回到合約指揮台</Link>
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "找不到合約"} /> : null}
      {item ? (
        <>
          <p className="text-sm text-[var(--muted)]">
            {item.contractNo} · {portalContractStatusLabel(item.status)}
            {item.signedAt ? ` · 簽約日期 ${formatSignedDate(item.signedAt)}` : ""}
            {item.status === "SIGNED" && item.signedAt && isContractRenewalDue(item.signedAt, new Date(), reminderDays)
              ? ` · 剩餘約 ${daysUntilContractExpiry(item.signedAt)} 天可續約`
              : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadBlob(await services.contractDocument(item.id));
                  setMessage(item.status === "ISSUED" ? "已下載待蓋章 PDF。" : "已下載合約 PDF。");
                } catch (error) {
                  setMessage(error instanceof ClientError ? error.message : "無法下載 PDF");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {item.hasPdf ? "下載已上傳 PDF" : "下載 PDF"}
            </Button>
            {item.status === "ISSUED" ? (
              <label className="btn inline-flex cursor-pointer">
                上傳蓋章後 PDF
                <input
                  className="hidden"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setMessage("");
                    upload.mutate(file);
                  }}
                />
              </label>
            ) : null}
          </div>
          {item.status === "ISSUED" ? (
            <p className="text-sm text-[var(--muted)]">立約方在 PDF 最後一頁。請在「甲方名稱」與「負責人」位置蓋公司大章與負責人小章後再上傳。</p>
          ) : null}
          {item.hasPdf ? (
            <p className="text-sm text-[var(--muted)]">以下為您上傳的蓋章 PDF 原檔（含雙方印章），不是範本畫面。</p>
          ) : null}
          {item.hasPdf ? (
            <ContractPdfViewer contractId={item.id} />
          ) : (
            <ContractBodyView body={item.body} seals={seals.data} />
          )}
          {item.status === "VOID" ? <p>這份合約已收回。</p> : null}
          {message ? <p className="text-sm">{message}</p> : null}
        </>
      ) : null}
    </div>
  );
}

export type ContractSealUrls = {
  companySealUrl?: string | null;
  personSealUrl?: string | null;
  companySealX?: number;
  companySealY?: number;
  personSealX?: number;
  personSealY?: number;
};

function decorateContractHtml(html: string, seals?: ContractSealUrls) {
  let next = ensureContractHtml(html);
  // 立約方甲方欄位的章改由 React 疊加定位，避免內文 inline 章干擾拖曳
  next = next.replace(/<span[^>]*data-contract-seal="(?:company|person)"[^>]*>[\s\S]*?<\/span>/gi, "");
  // 正文其他位置若仍有章標記，保留預覽圖
  if (seals?.companySealUrl) {
    next = next.replaceAll("〈大章〉", `<img src="${seals.companySealUrl}" alt="公司大章" class="contract-seal-img" width="72" height="72" />`);
  }
  if (seals?.personSealUrl) {
    next = next.replaceAll("〈小章〉", `<img src="${seals.personSealUrl}" alt="負責人小章" class="contract-seal-img" width="56" height="56" />`);
  }
  return next;
}

export function ContractBodyViewWithSeals({ body }: { body: string }) {
  const services = useServices();
  const seals = useQuery({ queryKey: ["contract-seals"], queryFn: () => services.contractSeals() });
  return <ContractBodyView body={body} seals={seals.data} />;
}

/** 顯示業者上傳（或系統產出）的合約 PDF 原檔。 */
export function ContractPdfViewer({ contractId }: { contractId: string }) {
  const services = useServices();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError("");
    void services
      .contractDocument(contractId)
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file.blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ClientError ? err.message : "無法載入合約 PDF");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contractId, services]);
  if (error) return <ErrorText message={error} />;
  if (!url) return <p className="text-sm text-[var(--muted)]">載入 PDF…</p>;
  return (
    <iframe
      title="合約 PDF"
      src={url}
      className="h-[75vh] w-full rounded-md border border-[var(--line)] bg-white"
    />
  );
}

export function ContractBodyView({
  body,
  seals,
}: {
  body: string;
  seals?: ContractSealUrls;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => decorateContractHtml(body, seals), [body, seals]);

  return (
    <div ref={rootRef} className="contract-body-view relative max-w-4xl space-y-5 border-t border-[var(--line)] px-6 py-8 text-sm leading-8 sm:px-10">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <PartySealOverlays rootRef={rootRef} seals={seals} watchKey={html} />
    </div>
  );
}

export function formatSignedDate(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

async function downloadBlob(file: { blob: Blob; name: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
