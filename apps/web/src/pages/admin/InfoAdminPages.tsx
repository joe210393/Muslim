import { CONTRACT_CHECKBOX_GROUPS, CONTRACT_RENEWAL_WINDOW_DAYS, DEFAULT_CONTRACT_BODY, DEFAULT_CONTRACT_TITLE, REPORT_SOURCES, STAFF_FEATURES, applicationStatusLabels, attachmentIsVisible, contractAdminTabs, contractStatusLabels, daysUntilContractExpiry, ensureContractHtml, isContractRenewalDue, reportFieldId, reportFieldsFor, sourceLabel, suggestedContractChecksForCategory, type ApplicationDetail, type ContractStatus, type ReportPreview, type ReportSource, type SavedReport } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { caseFactRows } from "./ApplicationReview";
import { CaseFacts, CaseLayout, type CaseJump } from "./CaseLayout";
import { useServices, useSession } from "../../app/session";
import { AttachmentImages } from "../../components/AttachmentImages";
import { OrgLink } from "../../components/OrgLink";
import { ContractRichEditor } from "../../components/ContractRichEditor";
import { standardReports } from "../../content/site-content";
import { ApplicationPreview, FileChooser, OpenPdfButton } from "../portal/PortalPages";
import { ContractBodyViewWithSeals, ContractPdfViewer, formatSignedDate } from "../portal/ContractFlow";
import { AdminPageHeader, Badge, Button, Card, DataTable, Empty, ErrorText, Field, Modal, PasswordInput, SectionHeader, SectionNav, SelectInput, StatCard, TextArea, TextInput, confirmDelete, tableRowClass, NoticeText, failNotice, type Notice } from "../../components/ui";
import { ClientError, type ContractTemplateItem, type Services } from "../../services/types";
import { formatTaipei } from "../../lib/format";

export function SiteReviewBody({ item, onChanged, onFlash, embedded = false, extraMain, extraJumps = [] }: { item: ApplicationDetail; onChanged: () => Promise<void>; onFlash?: (message: string) => void; embedded?: boolean; extraMain?: ReactNode; extraJumps?: CaseJump[] }) {
  const services = useServices();
  const session = useSession();
  const [note, setNote] = useState("");
  const [openNote, setOpenNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<Notice>(null);
  const canAct = session.user?.role === "ADMIN" || item.siteReviewerId === session.user?.id;
  const canReject = session.user?.role === "ADMIN";
  const applicationFiles = item.definition.attachmentRequirements.filter((requirement) => requirement.group !== "checklist" && attachmentIsVisible(requirement, item.formData));
  async function mark(requirementKey: string, result: "pass" | "fail") {
    try {
      await services.saveSiteCheck(item.id, { expectedVersion: item.version, requirementKey, result });
      setError(null);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "沒有登錄現場結果");
    }
  }
  async function addPhoto(requirementKey: string, files: File[]) {
    try {
      for (const file of files) await services.uploadSitePhoto(item.id, requirementKey, file);
      setError(null);
      setMessage("已加上現場拍攝的照片");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "照片沒有上傳");
    }
  }
  async function act(action: "PASS_SECOND" | "REQUEST_SUPPLEMENT" | "REJECT") {
    const written = note.trim();
    let publicComment: string | undefined;
    let internalNote: string | undefined;
    let fieldReviews = item.fieldReviews;
    if (action === "REQUEST_SUPPLEMENT") {
      const failed = applicationFiles.filter((requirement) => item.siteChecks.find((check) => check.key === requirement.key)?.result === "fail");
      if (failed.length === 0) {
        setError("請先把沒通過的附件標出來");
        return;
      }
      if (!written) {
        setError("請填寫給業者的補件說明");
        return;
      }
      publicComment = written;
      fieldReviews = failed.map((requirement) => ({ key: `attachment:${requirement.key}`, needsSupplement: true, publicComment: written, internalNote: "" }));
    } else if (action === "REJECT") {
      if (!written) {
        setError("請填寫退件的公開意見");
        return;
      }
      publicComment = written;
    } else {
      internalNote = written || "現場複審完成";
    }
    try {
      await services.review(item.id, {
        action,
        expectedVersion: item.version,
        requestId: crypto.randomUUID(),
        publicComment,
        internalNote,
        fieldReviews,
      });
      setError(null);
      const done = `${{ PASS_SECOND: "複審通過", REQUEST_SUPPLEMENT: "要求補件", REJECT: "退件" }[action]}：已完成`;
      if (onFlash) onFlash(done);
      else setMessage(done);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof ClientError ? reason.message : "動作失敗");
    }
  }
  const main = (
    <>
      {embedded ? null : (
        <AdminPageHeader
          title={item.applicationNo}
          description={<><OrgLink name={item.organizationName} organizationId={item.organizationId} /> · {item.categoryName}</>}
          actions={
            <>
              <Badge tone={applicationStatusLabels[item.status].tone}>{applicationStatusLabels[item.status].label}</Badge>
              <Link className="text-sm text-[var(--link)] underline" to="/admin/site-reviews">回到現場複審</Link>
            </>
          }
        />
      )}
      <p className="text-sm text-[var(--muted)]">現場複審人員：{item.siteReviewerName ?? "未指定"}。下面是初審通過的同一份線上預覽。通過後進入待核定。</p>
      {!canAct ? <p className="text-sm">這件已指定給 {item.siteReviewerName ?? "複審人員"}。你可以查看，不能改現場結果。</p> : null}
      <section id="site-preview" className="scroll-mt-4"><ApplicationPreview item={item} categoryName={item.categoryName} /></section>
      <Card id="site-checks" className="space-y-4">
        <h2 className="text-lg font-semibold">附件檢查</h2>
        <p className="text-sm text-[var(--muted)]">核對業者送件附件。可以只按通過；有需要再拍現場存證，不取代業者原照。</p>
        {applicationFiles.length === 0 ? <p className="text-sm text-[var(--muted)]">這件沒有可見的送件附件項目。</p> : null}
        {applicationFiles.map((requirement) => {
          const files = item.attachments.filter((file) => file.requirementKey === requirement.key && !file.capturedOnSite);
          const taken = item.attachments.filter((file) => file.requirementKey === requirement.key && file.capturedOnSite);
          const current = item.siteChecks.find((check) => check.key === requirement.key)?.result;
          return (
            <div key={requirement.key} className="space-y-2 border-t border-[var(--line)] pt-3">
              <p className="text-sm">{requirement.label}{files.length === 0 ? "：尚未上傳" : ""}</p>
              {files.filter((file) => file.mimeType === "application/pdf").map((file) => <OpenPdfButton key={file.id} fileId={file.fileId} name={file.originalName} />)}
              <AttachmentImages files={files} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={current === "pass" ? "primary" : "secondary"} aria-pressed={current === "pass"} disabled={!canAct} onClick={() => void mark(requirement.key, "pass")}>通過</Button>
                <Button type="button" variant={current === "fail" ? "danger" : "secondary"} aria-pressed={current === "fail"} disabled={!canAct} onClick={() => void mark(requirement.key, "fail")}>沒通過</Button>
              </div>
              <p className="text-sm text-[var(--muted)]">現場拍攝（可選）</p>
              {taken.length === 0 ? <p className="text-sm">尚未拍攝</p> : <AttachmentImages files={taken} />}
              {canAct ? <FileChooser label="上傳現場拍攝" accept="image/jpeg,image/png" multiple ariaLabel={`${requirement.label}現場拍攝`} onFiles={(files) => addPhoto(requirement.key, files)} /> : null}
            </div>
          );
        })}
      </Card>
      {embedded ? extraMain : null}
    </>
  );
  const panel = (
    <>
      {embedded ? <CaseFacts rows={caseFactRows(item)} /> : null}
      {canAct ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold">複審動作</h2>
          <Button className="w-full" variant="secondary" onClick={() => setOpenNote((current) => !current)}>{openNote ? "收合這次動作的意見" : "填寫這次動作的意見"}</Button>
          {openNote ? <Field label="給業者的說明" hint="要求補件或退件時必填。複審通過可以不填。"><TextArea value={note} onChange={(event) => setNote(event.target.value)} /></Field> : null}
          <div className="grid gap-2">
            <Button onClick={() => void act("PASS_SECOND")}>複審通過</Button>
            <Button variant="secondary" onClick={() => void act("REQUEST_SUPPLEMENT")}>要求補件</Button>
            {canReject ? <Button variant="danger" onClick={() => { if (window.confirm("確定退件？退件後案件會結束。")) void act("REJECT"); }}>退件</Button> : null}
          </div>
        </Card>
      ) : null}
      <NoticeText notice={message} />
      {error ? <ErrorText message={error} /> : null}
    </>
  );
  if (embedded) return <CaseLayout main={main} panel={panel} jumps={[{ id: "site-preview", label: "送件內容" }, { id: "site-checks", label: "附件檢查" }, ...extraJumps]} />;
  return (
    <div className="space-y-4">
      {main}
      {panel}
      <Link to="/admin/applications/second-review">回到案件審查</Link>
    </div>
  );
}

const NEW_TEMPLATE_BODY = DEFAULT_CONTRACT_BODY;

type AdminContractTab = (typeof contractAdminTabs)[number]["id"];

function RenewalReminderEditor() {
  const services = useServices();
  const client = useQueryClient();
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const [days, setDays] = useState("");
  const [message, setMessage] = useState<Notice>(null);
  useEffect(() => {
    if (setting.data) setDays(String(setting.data.renewalReminderDays));
  }, [setting.data]);
  if (!setting.data) return null;
  const version = setting.data.version;
  return (
    <Card>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = Number(days);
          if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
            setMessage(failNotice("續約提醒請填 1 到 365 天"));
            return;
          }
          try {
            await services.saveOperationSetting({ renewalReminderDays: parsed, expectedVersion: version });
            setMessage("已儲存。只影響可續約清單，已簽署的合約沒有改。");
            await client.invalidateQueries({ queryKey: ["operation-setting"] });
          } catch (error) {
            setMessage(failNotice(error instanceof ClientError ? error.message : "無法儲存"));
          }
        }}
      >
        <Field label="續約提醒天數" hint="已簽約、還沒過期，而且剩餘天數在這個範圍內，才會出現在可續約。">
          <TextInput inputMode="numeric" className="w-28" value={days} onChange={(event) => setDays(event.target.value)} />
        </Field>
        <Button type="submit">儲存</Button>
        <NoticeText notice={message} />
      </form>
    </Card>
  );
}

export function IssuedContractsPage() {
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const reminderDays = setting.data?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const renewable = (signedAt: string | null) => isContractRenewalDue(signedAt, new Date(), reminderDays);
  const requested = params.get("tab");
  const tab: AdminContractTab = contractAdminTabs.some((item) => item.id === requested) ? (requested as AdminContractTab) : "pending";
  const [previewId, setPreviewId] = useState<string | null>(null);
  const contracts = useQuery({ queryKey: ["admin-contracts"], queryFn: () => services.adminContracts() });
  const all = contracts.data ?? [];
  const counts = {
    pending: all.filter((item) => item.status === "ISSUED").length,
    signed: all.filter((item) => item.status === "SIGNED" || item.status === "RENEWED").length,
    renewable: all.filter((item) => item.status === "SIGNED" && renewable(item.signedAt)).length,
    not_renewed: all.filter((item) => item.status === "NOT_RENEWED").length,
    recalled: all.filter((item) => item.status === "VOID").length,
  };
  const rows = tab
    ? all.filter((item) => {
        if (tab === "pending") return item.status === "ISSUED";
        if (tab === "signed") return item.status === "SIGNED" || item.status === "RENEWED";
        if (tab === "renewable") return item.status === "SIGNED" && renewable(item.signedAt);
        if (tab === "not_renewed") return item.status === "NOT_RENEWED";
        if (tab === "recalled") return item.status === "VOID";
        return false;
      })
    : [];
  const tabLabel = contractAdminTabs.find((item) => item.id === tab)?.label ?? "合約";
  const selectTab = (id: string) => {
    setPreviewId(null);
    setParams({ tab: id });
  };
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="合約管理"
        description="發出的合約依狀態分開追蹤。用錯範本或欄位時，待上傳的可以修改；已經發給廠商的可以收回。"
        actions={<Link to="/admin/contracts/issue" className="btn btn-primary rounded-md px-3 py-2 text-sm no-underline">＋ 發送合約</Link>}
      />
      <RenewalReminderEditor />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {contractAdminTabs.map((item) => (
          <StatCard key={item.id} label={item.label} value={counts[item.id]} active={tab === item.id} onClick={() => selectTab(item.id)} />
        ))}
      </div>
      {tab ? (
        <>
          <SectionHeader
            title={`${tabLabel}列表`}
            hint={
              tab === "pending" ? "等業者下載 PDF、蓋章後上傳。用錯可以修改，或收回後重發。"
                : tab === "signed" ? "已簽約以實際上傳 PDF 當日為簽約日期。發錯請收回後重發。"
                  : tab === "renewable" ? `效期一年、剩餘 ${reminderDays} 天內的已簽約。續約付款方式尚未定。`
                    : tab === "recalled" ? "已從廠商端收回。可以再到發送合約，發一份正確的。"
                      : "業者已登記為未續約的合約。"
            }
          />
          {contracts.isLoading ? <p>載入中…</p> : null}
          {rows.length === 0 && !contracts.isLoading ? (
            <Empty
              title={`沒有${tabLabel}的合約`}
              body={tab === "renewable" ? `目前沒有剩餘 ${reminderDays} 天內到期的已簽約合約。` : "換上方的狀態，或到發送合約建立一份新合約。"}
            />
          ) : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="p-3 font-medium">合約編號</th>
                    <th className="p-3 font-medium">業者</th>
                    <th className="p-3 font-medium">標題</th>
                    <th className="p-3 font-medium">狀態</th>
                    <th className="p-3 font-medium">{tab === "pending" || tab === "recalled" ? "發出時間" : "簽約日期"}</th>
                    {tab === "renewable" ? <th className="p-3 font-medium">剩餘天數</th> : null}
                    <th className="p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--line)]">
                      <td className="p-3 font-medium">{item.contractNo}</td>
                      <td className="p-3"><OrgLink name={item.organizationName} organizationId={item.organizationId} /></td>
                      <td className="p-3">{item.title}</td>
                      <td className="p-3">
                        <Badge tone={contractStatusLabels[item.status].tone}>{contractStatusLabels[item.status].label}</Badge>
                      </td>
                      <td className="p-3">
                        {tab === "pending" || tab === "recalled"
                          ? formatTaipei(item.createdAt)
                          : item.signedAt
                            ? formatSignedDate(item.signedAt)
                            : "—"}
                      </td>
                      {tab === "renewable" ? (
                        <td className="p-3">{item.signedAt ? `約 ${daysUntilContractExpiry(item.signedAt)} 天` : "—"}</td>
                      ) : null}
                      <td className="p-3">
                        <button type="button" className="text-[var(--link)] underline" onClick={() => setPreviewId(item.id)}>
                          預覽
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      {previewId ? <ContractPreviewModal contractId={previewId} onClose={() => setPreviewId(null)} /> : null}
    </div>
  );
}

function ContractPreviewModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const services = useServices();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Notice>(null);
  const detail = useQuery({
    queryKey: ["admin-contract", contractId],
    queryFn: () => services.contract(contractId),
  });
  const item = detail.data;
  return (
    <Modal title={item ? `預覽 ${item.contractNo}` : "預覽合約"} onClose={onClose} wide>
      {detail.isLoading ? <p>載入中…</p> : null}
      {detail.error ? <ErrorText message={detail.error instanceof ClientError ? detail.error.message : "找不到合約"} /> : null}
      {item ? (
        <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl">{item.title}</h3>
            <Badge tone={contractStatusLabels[item.status].tone}>{contractStatusLabels[item.status].label}</Badge>
          </div>
          <p className="text-sm text-[var(--muted)]"><OrgLink name={item.organizationName} organizationId={item.organizationId} /></p>
          <p className="text-sm leading-7">{statusNote(item.status)}</p>
          {item.signedAt ? <p className="text-sm font-medium">簽約日期（上傳 PDF）：{formatSignedDate(item.signedAt)}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  await downloadBlob(await services.contractDocument(item.id));
                  setMessage(item.status === "ISSUED" ? "已下載待蓋章 PDF。" : "已下載合約 PDF。");
                } catch (error) {
                  setMessage(failNotice(error instanceof ClientError ? error.message : "無法下載"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {item.status === "ISSUED" ? "下載待蓋章 PDF" : "下載合約 PDF"}
            </Button>
            <Link to={`/admin/contracts/issued/${item.id}?edit=1`} className="btn rounded-md px-3 py-2 text-sm no-underline" onClick={onClose}>
              {item.status === "ISSUED" ? "修改合約" : "開啟完整頁"}
            </Link>
          </div>
          <NoticeText notice={message} />
          {item.hasPdf ? (
            <>
              <p className="text-sm text-[var(--muted)]">以下為業者上傳的蓋章 PDF 原檔。</p>
              <ContractPdfViewer contractId={item.id} />
            </>
          ) : (
            <ContractBodyViewWithSeals body={item.body} />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export function IssuedContractDetailPage() {
  const { contractId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const services = useServices();
  const client = useQueryClient();
  const detail = useQuery({ queryKey: ["admin-contract", contractId], queryFn: () => services.contract(contractId), enabled: Boolean(contractId) });
  const setting = useQuery({ queryKey: ["operation-setting"], queryFn: () => services.operationSetting() });
  const item = detail.data;
  const reminderDays = setting.data?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [notice, setNotice] = useState<Notice>(null);
  const [recalling, setRecalling] = useState(false);
  useEffect(() => {
    if (item && item.status !== "ISSUED") setEditing(false);
  }, [item]);
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={item?.contractNo ?? "合約"}
        description="待上傳的合約可以改範本和黃底欄位。已經發給廠商的，可以收回；收回後廠商看不到，也不能再上傳。"
        actions={<Link className="text-sm text-[var(--link)] underline" to="/admin/contracts">回到合約管理</Link>}
      />
      {detail.isLoading ? <p>載入中…</p> : null}
      {detail.error ? <ErrorText message={detail.error instanceof ClientError ? detail.error.message : "找不到合約"} /> : null}
      {item ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl">{item.title}</h2>
            <Badge tone={contractStatusLabels[item.status].tone}>{contractStatusLabels[item.status].label}</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]"><OrgLink name={item.organizationName} organizationId={item.organizationId} /></p>
          <p className="mt-3 text-sm leading-7">{statusNote(item.status)}</p>
          {item.signedAt ? <p className="mt-3 text-sm font-medium">簽約日期（上傳 PDF）：{formatSignedDate(item.signedAt)}</p> : null}
          {item.signerName ? <p className="mt-1 text-sm text-[var(--muted)]">上傳人 {item.signerName}</p> : null}
          {item.status === "SIGNED" && item.signedAt && isContractRenewalDue(item.signedAt, new Date(), reminderDays) ? (
            <p className="mt-2 text-sm text-amber-800">剩餘約 {daysUntilContractExpiry(item.signedAt)} 天到期，列在「可續約」。續約付款方式尚未定。</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={async () => downloadBlob(await services.contractDocument(item.id))}>
              {item.hasPdf ? "下載業者上傳 PDF" : "下載待蓋章 PDF"}
            </Button>
            {item.status === "ISSUED" ? (
              <Button type="button" onClick={() => { setEditing((open) => !open); setParams(editing ? {} : { edit: "1" }, { replace: true }); }}>
                {editing ? "關閉修改" : "修改合約"}
              </Button>
            ) : null}
            {item.status !== "VOID" ? (
              <Button
                type="button"
                variant="danger"
                disabled={recalling}
                onClick={async () => {
                  if (!window.confirm(`確定收回「${item.contractNo}」？廠商將看不到這份合約，也不能再上傳。之後可以重新發送正確的合約。`)) return;
                  setRecalling(true);
                  setNotice(null);
                  try {
                    await services.recallContract(item.id, { expectedVersion: item.version });
                    await client.invalidateQueries({ queryKey: ["admin-contract", item.id] });
                    await client.invalidateQueries({ queryKey: ["admin-contracts"] });
                    await client.invalidateQueries({ queryKey: ["issuable-organizations"] });
                    setEditing(false);
                    setParams({}, { replace: true });
                    setNotice("已收回。可以到發送合約再發一份。");
                  } catch (error) {
                    setNotice(failNotice(error instanceof ClientError ? error.message : "收回失敗"));
                  } finally {
                    setRecalling(false);
                  }
                }}
              >
                收回合約
              </Button>
            ) : null}
          </div>
          <NoticeText notice={notice} />
          {editing && item.status === "ISSUED" ? (
            <ContractReviseForm
              item={item}
              onClose={() => { setEditing(false); setParams({}, { replace: true }); }}
              onSaved={(text) => { setEditing(false); setParams({}, { replace: true }); setNotice(text); }}
            />
          ) : null}
          {item.hasPdf ? (
            <>
              <p className="mt-3 text-sm text-[var(--muted)]">以下為業者上傳的蓋章 PDF 原檔（含雙方印章）。</p>
              <div className="mt-3">
                <ContractPdfViewer contractId={item.id} />
              </div>
            </>
          ) : (
            <ContractBodyViewWithSeals body={item.body} />
          )}
        </Card>
      ) : null}
    </div>
  );
}

function ContractReviseForm({
  item,
  onClose,
  onSaved,
}: {
  item: Awaited<ReturnType<Services["contract"]>>;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const services = useServices();
  const client = useQueryClient();
  const templates = useQuery({ queryKey: ["contract-templates"], queryFn: () => services.contractTemplates() });
  const fill = item.fill;
  const [templateId, setTemplateId] = useState(item.templateId ?? "");
  const [siteName, setSiteName] = useState(fill?.siteName ?? "");
  const [feeAmount, setFeeAmount] = useState(fill?.feeAmount ?? "");
  const [partyBName, setPartyBName] = useState(fill?.partyBName ?? "");
  const [partyBAddress, setPartyBAddress] = useState(fill?.partyBAddress ?? "");
  const [partyBOwner, setPartyBOwner] = useState(fill?.partyBOwner ?? "");
  const [partyBTaxId, setPartyBTaxId] = useState(fill?.partyBTaxId ?? "");
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const group of CONTRACT_CHECKBOX_GROUPS) {
      for (const box of group.items) next[box.key] = Boolean(fill?.[box.key as keyof NonNullable<typeof fill>]);
    }
    return next;
  });
  const [message, setMessage] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!templateId && templates.data?.[0]) setTemplateId(templates.data[0].id);
  }, [templateId, templates.data]);
  const checkValue = (key: string) => Boolean(checks[key]);
  return (
    <form
      className="mt-4 space-y-4 rounded-md border border-amber-200 bg-amber-50 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await services.reviseContract(item.id, {
            templateId,
            expectedVersion: item.version,
            siteName,
            feeAmount,
            partyBName,
            partyBAddress,
            partyBOwner,
            partyBTaxId,
            checkHalalKitchen: checkValue("checkHalalKitchen"),
            checkHalalRestaurant: checkValue("checkHalalRestaurant"),
            checkMuslimFriendlyRestaurant: checkValue("checkMuslimFriendlyRestaurant"),
            checkMealService: checkValue("checkMealService"),
            checkDrinksSnacks: checkValue("checkDrinksSnacks"),
            checkFullHalalKitchen: checkValue("checkFullHalalKitchen"),
            checkPartialKitchen: checkValue("checkPartialKitchen"),
            checkRestaurantRestroom: checkValue("checkRestaurantRestroom"),
            lodgingWithBreakfast: checkValue("lodgingWithBreakfast"),
            lodgingWithoutBreakfast: checkValue("lodgingWithoutBreakfast"),
            itemBreakfast: checkValue("itemBreakfast"),
            itemGuestRoom: checkValue("itemGuestRoom"),
            checkExperience: checkValue("checkExperience"),
            checkExperienceWithFood: checkValue("checkExperienceWithFood"),
            checkExperienceWithoutFood: checkValue("checkExperienceWithoutFood"),
            checkEnvironment: checkValue("checkEnvironment"),
            checkShop: checkValue("checkShop"),
          });
          await client.invalidateQueries({ queryKey: ["admin-contract", item.id] });
          await client.invalidateQueries({ queryKey: ["admin-contracts"] });
          onSaved("已更新這份合約。業者下次看到的是修改後的內容。");
        } catch (error) {
          setMessage(failNotice(error instanceof ClientError ? error.message : "修改失敗"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm font-medium text-amber-950">修改這份合約</p>
      {fill ? null : <p className="text-sm">這份是較早發出的合約，沒有留下當初填的欄位。請再填一次後儲存，合約編號不會變。</p>}
      <Field label="範本版本">
        <select className="rounded-md border border-[var(--line)] bg-white px-3 py-2" value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
          <option value="">選擇版本</option>
          {templates.data?.map((template) => <option key={template.id} value={template.id}>{template.title} · 第 {template.revision} 版</option>)}
        </select>
      </Field>
      <Field label="驗證場域名稱"><TextInput value={siteName} onChange={(event) => setSiteName(event.target.value)} required /></Field>
      <Field label="費用總金額（新臺幣元，稅外加）"><TextInput value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} required /></Field>
      <div className="space-y-4 text-sm">
        {CONTRACT_CHECKBOX_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2 rounded-md border border-amber-100 bg-white/70 p-3">
            <p className="font-medium text-amber-950">{group.title}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((box) => (
                <label key={box.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={checkValue(box.key)} onChange={(event) => setChecks((current) => ({ ...current, [box.key]: event.target.checked }))} />
                  {box.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Field label="乙方名稱"><TextInput value={partyBName} onChange={(event) => setPartyBName(event.target.value)} /></Field>
      <Field label="乙方地址"><TextInput value={partyBAddress} onChange={(event) => setPartyBAddress(event.target.value)} /></Field>
      <Field label="乙方負責人"><TextInput value={partyBOwner} onChange={(event) => setPartyBOwner(event.target.value)} /></Field>
      <Field label="乙方統一編號"><TextInput value={partyBTaxId} onChange={(event) => setPartyBTaxId(event.target.value)} /></Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !templateId}>儲存修改</Button>
        <Button type="button" onClick={onClose}>取消</Button>
      </div>
      <NoticeText notice={message} />
    </form>
  );
}

function statusNote(status: ContractStatus) {
  if (status === "ISSUED") return "這份合約已發給業者，還在等下載 PDF、蓋章後上傳。用錯範本或欄位可以直接修改；若要讓業者看不到，請收回。";
  if (status === "SIGNED") return "業者已上傳蓋章 PDF。簽約日期以實際上傳當日為準。這份不能直接改內文；若發錯，請收回後重新發送。";
  if (status === "RENEWED") return "業者已把這份合約登記為已續約。續約費用與是否重新現場複審仍待確認。發錯可以收回後重發。";
  if (status === "NOT_RENEWED") return "業者已把這份合約登記為未續約。發錯可以收回後重發。";
  return "這份合約已從廠商端收回。廠商看不到，也不能再上傳。可以重新發送正確的合約。";
}

type IssuableOrg = Awaited<ReturnType<Services["issuableOrganizations"]>>[number];
type IssuableApp = IssuableOrg["pendingApplications"][number];

export function IssueContractPage() {
  const services = useServices();
  const client = useQueryClient();
  const navigate = useNavigate();
  const templates = useQuery({ queryKey: ["contract-templates"], queryFn: () => services.contractTemplates() });
  const issuable = useQuery({ queryKey: ["issuable-organizations"], queryFn: () => services.issuableOrganizations() });
  const [issueTemplateId, setIssueTemplateId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [categoryChecks, setCategoryChecks] = useState<Record<string, boolean>>({});
  const [partyBName, setPartyBName] = useState("");
  const [partyBAddress, setPartyBAddress] = useState("");
  const [partyBOwner, setPartyBOwner] = useState("");
  const [partyBTaxId, setPartyBTaxId] = useState("");
  const [message, setMessage] = useState<Notice>(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const unlocked = issuable.data ?? [];
  const selectedOrg = unlocked.find((item) => item.id === organizationId) ?? null;
  const pendingApps = selectedOrg?.pendingApplications ?? [];
  const selectedApp = pendingApps.find((item) => item.id === applicationId) ?? null;
  const applyApplication = (app: IssuableApp | null) => {
    if (!app) {
      setApplicationId("");
      return;
    }
    setApplicationId(app.id);
    setSiteName(app.siteName?.trim() || app.label);
    setCategoryChecks(suggestedContractChecksForCategory(app.categoryCode, app.formData ?? {}));
  };
  useEffect(() => {
    if (!issueTemplateId && templates.data?.[0]) setIssueTemplateId(templates.data[0].id);
  }, [issueTemplateId, templates.data]);
  useEffect(() => {
    if (!selectedOrg) return;
    setPartyBName(selectedOrg.organizationName);
    setPartyBAddress(selectedOrg.address ?? "");
    setPartyBOwner(selectedOrg.contactName ?? "");
    setPartyBTaxId(selectedOrg.taxId ?? "");
    if (selectedOrg.pendingApplications.length === 1) applyApplication(selectedOrg.pendingApplications[0] ?? null);
    else {
      setApplicationId("");
      setCategoryChecks({});
    }
  }, [selectedOrg?.id]);
  const checkValue = (key: string) => Boolean(categoryChecks[key]);
  const setCheck = (key: string, checked: boolean) => setCategoryChecks((current) => ({ ...current, [key]: checked }));
  return (
    <div className="space-y-4">
      <AdminPageHeader title="發送合約" description="僅已核帳業者可發約。選業者後會帶出尚未完成合約的申請類別；有多筆時請先選要發哪一筆。發出後若用錯，可在合約頁修改；已經發給廠商的可以收回。" />
      {issuable.isLoading ? <p>載入中…</p> : null}
      {!issuable.isLoading && unlocked.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-sm">
          <p className="font-medium text-[var(--ink)]">目前沒有可發約的業者</p>
          <p className="leading-6 text-[var(--muted)]">業者付款後要先完成核帳才能發約。核帳完成的業者會出現在這裡。</p>
          <Link className="btn btn-primary inline-block rounded-md px-3 py-2 no-underline" to="/admin/payments/reconciliation">去核帳</Link>
        </div>
      ) : null}
      {unlocked.length > 0 ? (
      <Card>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          if (pendingApps.length > 0 && !applicationId) {
            setMessage(failNotice("此業者有多筆／待處理申請，請先選擇要發約的申請。"));
            return;
          }
          try {
            const created = await services.issueContract({
              organizationId,
              templateId: issueTemplateId,
              applicationId: applicationId || null,
              siteName,
              feeAmount,
              checkHalalKitchen: checkValue("checkHalalKitchen"),
              checkHalalRestaurant: checkValue("checkHalalRestaurant"),
              checkMuslimFriendlyRestaurant: checkValue("checkMuslimFriendlyRestaurant"),
              checkMealService: checkValue("checkMealService"),
              checkDrinksSnacks: checkValue("checkDrinksSnacks"),
              checkFullHalalKitchen: checkValue("checkFullHalalKitchen"),
              checkPartialKitchen: checkValue("checkPartialKitchen"),
              checkRestaurantRestroom: checkValue("checkRestaurantRestroom"),
              lodgingWithBreakfast: checkValue("lodgingWithBreakfast"),
              lodgingWithoutBreakfast: checkValue("lodgingWithoutBreakfast"),
              itemBreakfast: checkValue("itemBreakfast"),
              itemGuestRoom: checkValue("itemGuestRoom"),
              checkExperience: checkValue("checkExperience"),
              checkExperienceWithFood: checkValue("checkExperienceWithFood"),
              checkExperienceWithoutFood: checkValue("checkExperienceWithoutFood"),
              checkEnvironment: checkValue("checkEnvironment"),
              checkShop: checkValue("checkShop"),
              partyBName,
              partyBAddress,
              partyBOwner,
              partyBTaxId,
            });
            await client.invalidateQueries({ queryKey: ["admin-contracts"] });
            await client.invalidateQueries({ queryKey: ["issuable-organizations"] });
            navigate(`/admin/contracts/issued/${created.id}`);
          } catch (error) {
            setMessage(failNotice(error instanceof ClientError ? error.message : "發出失敗"));
          }
        }}>
          <div className="flex flex-wrap items-end gap-3">
            <Field group label="業者（已核帳）">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[16rem] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                  {selectedOrg ? (
                    <span>
                      <OrgLink name={selectedOrg.organizationName} organizationId={selectedOrg.id} />
                      {selectedOrg.taxId ? ` · ${selectedOrg.taxId}` : ""}
                      {selectedApp ? ` · ${selectedApp.label}` : ""}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">尚未選擇業者</span>
                  )}
                </div>
                <Button type="button" onClick={() => setOrgPickerOpen(true)} disabled={unlocked.length === 0}>
                  搜尋業者
                </Button>
                {selectedOrg ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--link)] underline"
                    onClick={() => {
                      setOrganizationId("");
                      setApplicationId("");
                      setSiteName("");
                      setCategoryChecks({});
                      setPartyBName("");
                      setPartyBAddress("");
                      setPartyBOwner("");
                      setPartyBTaxId("");
                    }}
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </Field>
            <Field label="範本版本">
              <select className="rounded-md border border-[var(--line)] bg-white px-3 py-2" value={issueTemplateId} onChange={(event) => setIssueTemplateId(event.target.value)} required>
                <option value="">選擇版本</option>
                {templates.data?.map((item) => <option key={item.id} value={item.id}>{item.title} · 第 {item.revision} 版</option>)}
              </select>
            </Field>
          </div>
          {selectedOrg ? (
            <div className="space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="text-sm font-medium">尚未完成合約的申請</p>
              {pendingApps.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">這家業者目前沒有待發約的申請，仍可手動填寫黃底欄位發約。</p>
              ) : (
                <div className="space-y-2">
                  {pendingApps.map((app) => (
                    <label key={app.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="issue-application"
                        checked={applicationId === app.id}
                        onChange={() => applyApplication(app)}
                      />
                      <span>
                        <span className="font-medium">{app.label}</span>
                        <span className="mt-1 block text-[var(--muted)]">{app.applicationNo} · {applicationStatusLabels[app.status as keyof typeof applicationStatusLabels]?.label ?? app.status}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {orgPickerOpen ? (
            <IssuableOrganizationPickerModal
              organizations={unlocked}
              onClose={() => setOrgPickerOpen(false)}
              onPick={(org) => {
                setOrganizationId(org.id);
                setOrgPickerOpen(false);
              }}
            />
          ) : null}
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">黃底欄位（管理員填寫）</p>
            <Field label="驗證場域名稱"><TextInput value={siteName} onChange={(event) => setSiteName(event.target.value)} required /></Field>
            <Field label="費用總金額（新臺幣元，稅外加）"><TextInput value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} required /></Field>
            <div className="space-y-4 text-sm">
              <p className="font-medium">驗證類別／項目勾選（依合約表格分組）</p>
              {CONTRACT_CHECKBOX_GROUPS.map((group) => (
                <div key={group.id} className="space-y-2 rounded-md border border-amber-100 bg-white/70 p-3">
                  <p className="font-medium text-amber-950">{group.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <label key={item.key} className="flex items-center gap-2">
                        <input type="checkbox" checked={checkValue(item.key)} onChange={(event) => setCheck(item.key, event.target.checked)} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Field label="乙方名稱"><TextInput value={partyBName} onChange={(event) => setPartyBName(event.target.value)} /></Field>
            <Field label="乙方地址"><TextInput value={partyBAddress} onChange={(event) => setPartyBAddress(event.target.value)} /></Field>
            <Field label="乙方負責人"><TextInput value={partyBOwner} onChange={(event) => setPartyBOwner(event.target.value)} /></Field>
            <Field label="乙方統一編號"><TextInput value={partyBTaxId} onChange={(event) => setPartyBTaxId(event.target.value)} /></Field>
          </div>
          <p className="text-sm text-[var(--muted)]">發出後，立約方「甲方：伊斯蘭商務發展有限公司」與「負責人：簡佩平」會標示公司大章／負責人小章蓋章位置（蓋在名稱上）。</p>
          <Button type="submit" disabled={!organizationId || !issueTemplateId || (pendingApps.length > 0 && !applicationId)}>發出合約</Button>
        </form>
        <NoticeText notice={message} />
      </Card>
      ) : null}
    </div>
  );
}

function IssuableOrganizationPickerModal({
  organizations,
  onClose,
  onPick,
}: {
  organizations: IssuableOrg[];
  onClose: () => void;
  onPick: (org: IssuableOrg) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const q = keyword.trim().toLowerCase();
  const matched = organizations.filter((org) => {
    if (!q) return true;
    const apps = org.pendingApplications.map((item) => item.label).join(" ");
    const haystack = `${org.organizationName} ${org.taxId ?? ""} ${org.contactName ?? ""} ${org.address ?? ""} ${apps}`.toLowerCase();
    return haystack.includes(q);
  });
  return (
    <Modal title="搜尋已核帳業者" onClose={onClose}>
      <div className="space-y-3">
        <Field label="關鍵字">
          <TextInput
            autoFocus
            placeholder="業者名稱、統編、申請類別或地址"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="搜尋業者"
          />
        </Field>
        <p className="text-sm text-[var(--muted)]">
          {q ? `符合 ${matched.length} 筆` : `共 ${organizations.length} 家已核帳業者，輸入關鍵字縮小範圍。`}
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {matched.map((org) => (
            <button
              key={org.id}
              type="button"
              className="btn block w-full rounded-md px-3 py-2 text-left text-sm"
              onClick={() => onPick(org)}
            >
              <span className="block font-medium">{org.organizationName}</span>
              <span className="block text-[var(--muted)]">
                {[org.taxId, org.contactName, org.address].filter(Boolean).join(" · ") || "尚無統編／聯絡資料"}
              </span>
              <span className="mt-1 block text-[var(--muted)]">
                {org.pendingApplications.length
                  ? `待發約：${org.pendingApplications.map((item) => item.label).join("、")}`
                  : "目前沒有尚未完成合約的申請"}
              </span>
            </button>
          ))}
          {matched.length === 0 ? <p className="text-sm text-[var(--muted)]">沒有符合的業者。</p> : null}
        </div>
      </div>
    </Modal>
  );
}

export function ContractSealsPage() {
  const services = useServices();
  const client = useQueryClient();
  const seals = useQuery({ queryKey: ["contract-seals"], queryFn: () => services.contractSeals() });
  const [message, setMessage] = useState<Notice>(null);
  const upload = async (kind: "company" | "person", file: File | undefined) => {
    if (!file) return;
    try {
      await services.uploadContractSeal(kind, file);
      setMessage(kind === "company" ? "公司大章已儲存" : "負責人小章已儲存");
      await client.invalidateQueries({ queryKey: ["contract-seals"] });
    } catch (error) {
      setMessage(failNotice(error instanceof ClientError ? error.message : "上傳失敗"));
    }
  };
  return (
    <div className="space-y-4">
      <AdminPageHeader title="大小章" description="上傳甲方公司大章與負責人小章電子檔（JPEG／PNG）。蓋章位置請到「合約範本 → 內文排版」的立約方甲方欄拖曳調整，放開後會同步到預覽與下載 PDF。" />
      <Card>
        {seals.isLoading ? <p>載入中…</p> : null}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-medium">公司大章</h2>
            {seals.data?.companySealUrl ? (
              <img src={seals.data.companySealUrl} alt="公司大章" className="mt-3 h-36 w-36 object-contain" />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">尚未上傳</p>
            )}
            <label className="btn mt-3 inline-flex cursor-pointer rounded-md px-3.5 py-2 text-sm font-medium">
              上傳大章
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void upload("company", file);
                }}
              />
            </label>
          </div>
          <div>
            <h2 className="text-lg font-medium">負責人小章</h2>
            {seals.data?.personSealUrl ? (
              <img src={seals.data.personSealUrl} alt="負責人小章" className="mt-3 h-28 w-28 object-contain" />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">尚未上傳</p>
            )}
            <label className="btn mt-3 inline-flex cursor-pointer rounded-md px-3.5 py-2 text-sm font-medium">
              上傳小章
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void upload("person", file);
                }}
              />
            </label>
          </div>
        </div>
        <NoticeText notice={message} />
      </Card>
    </div>
  );
}

export function ContractTemplatesPage() {
  const services = useServices();
  const client = useQueryClient();
  const templates = useQuery({ queryKey: ["contract-templates"], queryFn: () => services.contractTemplates() });
  const [editor, setEditor] = useState<"new" | ContractTemplateItem | null>(null);
  const [message, setMessage] = useState<Notice>(null);
  const rows = [...(templates.data ?? [])].sort((left, right) => left.title.localeCompare(right.title, "zh-Hant") || right.revision - left.revision);
  useEffect(() => {
    if (!editor || editor === "new") return;
    const fresh = templates.data?.find((item) => item.id === editor.id);
    if (fresh && fresh !== editor) setEditor(fresh);
  }, [templates.data, editor]);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["contract-templates"] });
  };
  return (
    <div className="space-y-4">
      <AdminPageHeader title="合約範本" description="用視覺編輯器排版、畫表格，可填欄位用工具列插入。已發出的合約不會跟著改。" />
      <NoticeText notice={message} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">範本列表</h2>
          <p className="text-sm text-[var(--muted)]">同一代碼可留多版；發出時選定當下那一版。</p>
        </div>
        <Button onClick={() => setEditor("new")}>＋ 新增範本</Button>
      </div>
      {templates.isLoading ? <p>載入中…</p> : null}
      {!templates.isLoading && rows.length === 0 ? (
        <Empty title="還沒有合約範本" body="按右上角「＋ 新增範本」建立第一份。" />
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">標題</th>
                <th className="p-3 font-medium">版次</th>
                <th className="p-3 font-medium">更新時間</th>
                <th className="p-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-[var(--line)]">
                  <td className="p-3">{item.title}</td>
                  <td className="p-3">第 {item.revision} 版</td>
                  <td className="p-3">{formatTaipei(item.updatedAt)}</td>
                  <td className="p-3">
                    <button type="button" className="text-[var(--link)] underline" onClick={() => setEditor(item)}>編輯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {editor ? (
        <ContractTemplateEditorModal
          template={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onMessage={setMessage}
          onSaved={async () => {
            await refresh();
            setEditor(null);
          }}
          onVersionSaved={async (created) => {
            setMessage(`已新增第 ${created.revision} 版`);
            await refresh();
            setEditor(created);
          }}
        />
      ) : null}
    </div>
  );
}

function ContractTemplateEditorModal({
  template,
  onClose,
  onMessage,
  onSaved,
  onVersionSaved,
}: {
  template: ContractTemplateItem | null;
  onClose: () => void;
  onMessage: (message: Notice) => void;
  onSaved: () => Promise<void>;
  onVersionSaved: (created: ContractTemplateItem) => Promise<void>;
}) {
  const services = useServices();
  const creating = !template;
  const [title, setTitle] = useState(template?.title ?? DEFAULT_CONTRACT_TITLE);
  const [body, setBody] = useState(ensureContractHtml(template?.body ?? NEW_TEMPLATE_BODY));
  const [expectedVersion, setExpectedVersion] = useState(template?.version ?? 1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitle(template?.title ?? DEFAULT_CONTRACT_TITLE);
    setBody(ensureContractHtml(template?.body ?? NEW_TEMPLATE_BODY));
    setExpectedVersion(template?.version ?? 1);
  }, [template]);
  return (
    <Modal title={creating ? "新增範本" : "編輯範本"} onClose={onClose} wide>
      <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
        <p className="text-sm text-[var(--muted)]">可直接編排文字與表格。立約方為左右對列；在內文排版裡拖曳甲方大小章即可調整蓋章位置。</p>
        <Field label="標題"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field group label="內文排版">
          <ContractRichEditor
            contentKey={template ? `${template.id}:${template.revision}:${template.version}` : "new"}
            value={body}
            onChange={setBody}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const html = ensureContractHtml(body);
                if (creating) {
                  await services.createContractTemplate({ title, body: html });
                  onMessage("已新增範本");
                } else if (template) {
                  await services.saveContractTemplate(template.id, { title, body: html, expectedVersion });
                  onMessage("這一版已儲存");
                }
                await onSaved();
              } catch (error) {
                onMessage(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {creating ? "建立範本" : "儲存這一版"}
          </Button>
          {!creating && template ? (
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const created = await services.createContractTemplateVersion(template.id, { title, body: ensureContractHtml(body) });
                  await onVersionSaved(created);
                } catch (error) {
                  onMessage(failNotice(error instanceof ClientError ? error.message : "新增版本失敗"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              另存新版
            </Button>
          ) : null}
        </div>
        <div className="border-t border-[var(--line)] pt-4">
          <h3 className="text-lg font-medium">預覽</h3>
          <p className="mb-2 text-sm text-[var(--muted)]">預覽僅供查看；大小章位置請在上方內文排版調整。</p>
          <ContractBodyViewWithSeals body={body} />
        </div>
      </div>
    </Modal>
  );
}

export function ReportsPage() {
  const services = useServices();
  const [part, setPart] = useState("built");
  return (
    <div className="space-y-6">
      <AdminPageHeader title="報表" description="自訂報表可以同時勾選案件、業者、訓練報名和合約，存下來之後在畫面上看表格、長條圖或圓餅圖。" />
      <SectionNav items={[{ id: "built", label: "既有報表" }, { id: "custom", label: "自訂報表" }]} value={part} onChange={setPart} />
      {part === "built" ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-3 font-medium">報表</th><th className="p-3 font-medium">欄位</th><th className="p-3 font-medium">狀態</th></tr></thead>
              <tbody>
                {standardReports.map((report) => (
                  <tr key={report.name} className="border-t border-[var(--line)]">
                    <td className="p-3">{report.name}</td>
                    <td className="p-3">{report.fields}</td>
                    <td className="p-3">{report.ready ? "可匯出現有資料" : "待資料齊全"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={async () => downloadText("applications.csv", await services.exportApplications())}>下載案件進度 CSV</Button>
            <Link to="/admin/imports">資料匯入</Link>
          </div>
        </>
      ) : <CustomReports />}
    </div>
  );
}

function emptyPicked(): Record<ReportSource, string[]> {
  return { APPLICATION: [], ORGANIZATION: [], ENROLLMENT: [], CONTRACT: [] };
}

function pickedFrom(report: SavedReport | null) {
  const picked = emptyPicked();
  for (const selection of report?.selections ?? []) picked[selection.source] = [...selection.fieldKeys];
  return picked;
}

function selectionsFrom(picked: Record<ReportSource, string[]>) {
  return REPORT_SOURCES.map((item) => ({ source: item.key, fieldKeys: picked[item.key] })).filter((item) => item.fieldKeys.length > 0);
}

function CustomReports() {
  const services = useServices();
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ["saved-reports"], queryFn: () => services.savedReports() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState<ReportSource>("APPLICATION");
  const [picked, setPicked] = useState(emptyPicked);
  const [chartKind, setChartKind] = useState<SavedReport["chartKind"]>("table");
  const [chartField, setChartField] = useState("");
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [message, setMessage] = useState<Notice>(null);
  const [error, setError] = useState("");
  const selections = selectionsFrom(picked);
  const preview = useQuery({
    queryKey: ["report-preview", selections],
    queryFn: () => services.previewReport({ selections }),
    enabled: selections.length > 0,
  });
  const fields = reportFieldsFor(source);
  const fieldOptions = selections.flatMap((selection) => selection.fieldKeys.map((key) => {
    const field = reportFieldsFor(selection.source).find((item) => item.key === key);
    return { id: reportFieldId(selection.source, key), label: `${sourceLabel(selection.source)}／${field?.label ?? key}` };
  }));

  function load(report: SavedReport | null) {
    setSelectedId(report?.id ?? null);
    setName(report?.name ?? "");
    setPicked(pickedFrom(report));
    setChartKind(report?.chartKind ?? "table");
    setChartField(report?.chartField ?? "");
    setVersion(report?.version);
    setSaved(report);
    setMessage("");
    setError("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!name.trim() || selections.length === 0) {
      setError("請填名稱，並至少在一個來源勾選欄位");
      return;
    }
    const field = fieldOptions.some((option) => option.id === chartField) ? chartField : (fieldOptions[0]?.id ?? "");
    try {
      const next = await services.saveReport({ name, selections, chartKind, chartField: field, expectedVersion: version }, selectedId ?? undefined);
      setSelectedId(next.id);
      setVersion(next.version);
      setChartField(next.chartField);
      setSaved(next);
      setMessage("已儲存。離開這一頁再回來，欄位和圖表還在。");
      await queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.message : "儲存失敗");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        <Button onClick={() => load(null)}>＋ 新增報表</Button>
        {(reports.data ?? []).map((report) => (
          <button key={report.id} className={`btn block w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === report.id ? "is-selected" : ""}`} type="button" onClick={() => load(report)}>
            {report.name}
          </button>
        ))}
        {reports.data?.length === 0 ? <p className="text-sm text-[var(--muted)]">還沒有自訂報表。</p> : null}
      </div>
      <div className="space-y-4">
        <Card className="space-y-4">
          <Field label="報表名稱"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <SectionNav
            items={REPORT_SOURCES.map((item) => ({ id: item.key, label: picked[item.key].length ? `${item.label}（${picked[item.key].length}）` : item.label }))}
            value={source}
            onChange={(next) => setSource(next as ReportSource)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked[source].includes(field.key)}
                  onChange={(event) => setPicked((current) => ({
                    ...current,
                    [source]: event.target.checked ? [...current[source], field.key] : current[source].filter((key) => key !== field.key),
                  }))}
                />
                {field.label}
              </label>
            ))}
          </div>
          <p className="text-sm text-[var(--muted)]">換到下一個來源時，前面勾過的欄位會留著。密碼、登入憑證、簽名圖檔與合約全文不能選。案件只包含這個帳號看得到的案件。</p>
          {error ? <ErrorText message={error} /> : null}
          <NoticeText notice={message} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()}>儲存</Button>
            <Button disabled={!saved} onClick={async () => { if (!saved) return; downloadText(`${saved.name}.csv`, await services.exportReport(saved.id)); }}>下載 CSV</Button>
            <Button variant="danger" disabled={!saved} onClick={async () => {
              if (!saved || !confirmDelete(saved.name)) return;
              await services.deleteReport(saved.id);
              load(null);
              await queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
            }}>刪除</Button>
          </div>
        </Card>
        <ReportView
          preview={selections.length ? preview.data : undefined}
          loading={preview.isFetching}
          failed={preview.error instanceof ClientError ? preview.error.message : preview.error ? "無法顯示報表" : ""}
          chartKind={chartKind}
          chartField={fieldOptions.some((option) => option.id === chartField) ? chartField : (fieldOptions[0]?.id ?? "")}
          fieldOptions={fieldOptions}
          onChartKind={setChartKind}
          onChartField={setChartField}
        />
      </div>
    </div>
  );
}

const CHART_COLORS = ["#0e6b3a", "#b8893a", "#08351e", "#2f7d6d", "#a56b2a", "#6b4c9a", "#9a4d55", "#efe4d2"];

function compactPoints(points: Array<{ label: string; count: number }>, limit: number) {
  if (points.length <= limit) return points;
  const rest = points.slice(limit).reduce((sum, point) => sum + point.count, 0);
  return [...points.slice(0, limit), { label: "其他", count: rest }];
}

function ReportView({
  preview,
  loading,
  failed,
  chartKind,
  chartField,
  fieldOptions,
  onChartKind,
  onChartField,
}: {
  preview?: ReportPreview;
  loading: boolean;
  failed: string;
  chartKind: SavedReport["chartKind"];
  chartField: string;
  fieldOptions: Array<{ id: string; label: string }>;
  onChartKind: (kind: SavedReport["chartKind"]) => void;
  onChartField: (field: string) => void;
}) {
  const [source, fieldKey] = chartField.split(".");
  const section = preview?.sections.find((item) => item.source === source);
  const group = section?.groups.find((item) => item.fieldKey === fieldKey);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionNav items={[{ id: "table", label: "表格" }, { id: "bar", label: "長條圖" }, { id: "pie", label: "圓餅圖" }]} value={chartKind} onChange={(next) => onChartKind(next as SavedReport["chartKind"])} />
        {chartKind === "table" ? null : (
          <Field label="統計欄位">
            <SelectInput value={chartField} onChange={(event) => onChartField(event.target.value)}>
              {fieldOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </SelectInput>
          </Field>
        )}
      </div>
      {failed ? <ErrorText message={failed} /> : null}
      {loading && !preview ? <p className="text-sm">載入報表…</p> : null}
      {!preview && !loading ? <p className="text-sm text-[var(--muted)]">勾選欄位後，這裡會顯示現有資料。</p> : null}
      {preview && chartKind === "table" ? preview.sections.map((item) => (
        <div key={item.source} className="space-y-2">
          <h2 className="text-base font-medium">{item.label}</h2>
          <p className="text-sm text-[var(--muted)]">共 {item.total} 筆{item.total > item.rows.length ? `，畫面顯示前 ${item.rows.length} 筆` : ""}。</p>
          <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>{item.columns.map((column) => <th key={column.key} className="p-3 font-medium">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {item.rows.map((row, index) => (
                  <tr key={`${item.source}-${index}`} className="border-t border-[var(--line)]">
                    {item.columns.map((column) => <td key={column.key} className="p-3">{row[column.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : null}
      {preview && chartKind !== "table" && group ? <CountChart kind={chartKind} title={fieldOptions.find((option) => option.id === chartField)?.label ?? group.label} points={group.points} /> : null}
    </Card>
  );
}

function CountChart({ kind, title, points }: { kind: "bar" | "pie"; title: string; points: Array<{ label: string; count: number }> }) {
  const shown = compactPoints(points, kind === "pie" ? 8 : 12);
  const total = shown.reduce((sum, point) => sum + point.count, 0);
  if (!total) return <p className="text-sm text-[var(--muted)]">這個欄位目前沒有資料。</p>;
  if (kind === "bar") {
    const max = Math.max(...shown.map((point) => point.count));
    return (
      <div className="space-y-3">
        <h2 className="text-base font-medium">{title}</h2>
        {shown.map((point) => (
          <div key={point.label} className="grid items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_3rem]">
            <span className="truncate">{point.label}</span>
            <div className="h-3 rounded-full bg-[var(--panel)]">
              <div className="h-3 rounded-full bg-[var(--accent-deep)]" style={{ width: `${(point.count / max) * 100}%` }} />
            </div>
            <span>{point.count}</span>
          </div>
        ))}
      </div>
    );
  }
  let cursor = 0;
  const stops = shown.map((point, index) => {
    const start = cursor;
    cursor += (point.count / total) * 100;
    return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium">{title}</h2>
      <div className="flex flex-wrap items-center gap-6">
        <div className="h-48 w-48 rounded-full border border-[var(--line)]" style={{ background: `conic-gradient(${stops.join(",")})` }} />
        <ul className="space-y-2 text-sm">
          {shown.map((point, index) => (
            <li key={point.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span>{point.label}</span>
              <span className="text-[var(--muted)]">{point.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeatureChecks({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {STAFF_FEATURES.map((feature) => {
        const checked = selected.includes(feature.key);
        return (
          <label key={feature.key} className={`btn flex items-center gap-2 rounded-md px-3 py-2 text-sm ${checked ? "is-selected" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(event.target.checked ? [...selected, feature.key] : selected.filter((key) => key !== feature.key))}
            />
            {feature.label}
          </label>
        );
      })}
    </div>
  );
}

export function PermissionsPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["access"], queryFn: () => services.accessSettings() });
  const [message, setMessage] = useState<Notice>(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "integrations" ? "integrations" : "staff");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [integrationKey, setIntegrationKey] = useState("");
  const [form, setForm] = useState({ email: "", displayName: "", password: "", features: [] as string[] });
  const accounts = (query.data?.accounts ?? []).filter((account) => `${account.displayName} ${account.email}`.toLowerCase().includes(keyword.trim().toLowerCase()));
  const selected = accounts.find((account) => account.id === selectedId) ?? query.data?.accounts.find((account) => account.id === selectedId);
  const integration = query.data?.integrations.find((item) => item.key === integrationKey) ?? query.data?.integrations[0];
  return (
    <div className="space-y-4">
      <AdminPageHeader title="員工" description="這裡只管理公司員工。建立帳號時一併勾選這個人能用的功能。業者請用前台註冊，功能固定，不會出現在這份名單。" />
      <SectionNav items={[{ id: "staff", label: "員工與權限" }, { id: "integrations", label: "串接" }]} value={tab} onChange={setTab} />
      {selectedId ? null : <NoticeText notice={message} />}
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入設定"} /> : null}
      {tab === "staff" && query.data ? (
        <div className="space-y-3">
          <SectionHeader
            title="員工列表"
            hint={`共 ${accounts.length} 位`}
            actions={<>
              <TextInput className="w-56" placeholder="搜尋姓名或 Email" value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label="搜尋員工" />
              <Button onClick={() => setSelectedId("new")}>＋ 新增員工</Button>
            </>}
          />
          {accounts.length === 0 ? <Empty title="沒有符合的員工" body="換個關鍵字，或按「＋ 新增員工」。" /> : (
            <DataTable columns={["名稱", "Email", "狀態", "已開通功能", "操作"]}>
              {accounts.map((account) => (
                <tr key={account.id} className={tableRowClass}>
                  <td className="p-3 font-medium">{account.displayName}</td>
                  <td className="p-3 break-all">{account.email}</td>
                  <td className="p-3"><Badge tone={account.isActive ? "success" : "neutral"}>{account.isActive ? "啟用" : "停用"}</Badge></td>
                  <td className="p-3">{account.features.filter((feature) => feature.enabled).length} 項</td>
                  <td className="p-3"><button type="button" className="table-action" onClick={() => setSelectedId(account.id)}>管理</button></td>
                </tr>
              ))}
            </DataTable>
          )}
          {selectedId === "new" ? (
            <Modal title="新增員工" wide onClose={() => setSelectedId(null)}>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Email"><TextInput value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
                <Field label="名稱"><TextInput value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
                <Field label="密碼"><PasswordInput value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
              </div>
              <FeatureChecks selected={form.features} onChange={(features) => setForm({ ...form, features })} />
              <Button onClick={async () => {
                try {
                  await services.createUser(form);
                  setForm({ email: "", displayName: "", password: "", features: [] });
                  setMessage("已建立員工帳號，並套用勾選的功能");
                  setSelectedId(null);
                  await client.invalidateQueries({ queryKey: ["access"] });
                  await client.invalidateQueries({ queryKey: ["users"] });
                } catch (error) {
                  setMessage(failNotice(error instanceof ClientError ? error.message : "建立失敗"));
                }
              }}>建立帳號</Button>
              <NoticeText notice={message} />
            </div>
            </Modal>
          ) : selected ? (
            <Modal title={selected.displayName} wide onClose={() => setSelectedId(null)}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">{selected.email} · {selected.isActive ? "啟用" : "停用"}</p>
                <Button variant="secondary" onClick={async () => {
                  try {
                    await services.updateUser(selected.id, { isActive: !selected.isActive });
                    setMessage(selected.isActive ? "已停用這個員工" : "已重新啟用");
                    await client.invalidateQueries({ queryKey: ["access"] });
                    await client.invalidateQueries({ queryKey: ["users"] });
                  } catch (error) {
                    setMessage(failNotice(error instanceof ClientError ? error.message : "更新失敗"));
                  }
                }}>{selected.isActive ? "停用" : "啟用"}</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {selected.features.map((feature) => (
                  <label key={feature.featureKey} className={`btn flex items-center gap-2 rounded-md px-3 py-2 text-sm ${feature.enabled ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      aria-label={`${selected.email} ${feature.label}`}
                      onChange={async (event) => {
                        try {
                          await services.updateFeature({ userId: selected.id, featureKey: feature.featureKey, enabled: event.target.checked });
                          setMessage(`已更新 ${selected.email} 的功能`);
                          await client.invalidateQueries({ queryKey: ["access"] });
                          await client.invalidateQueries({ queryKey: ["me"] });
                        } catch (error) {
                          setMessage(failNotice(error instanceof ClientError ? error.message : "更新失敗"));
                        }
                      }}
                    />
                    {feature.label}
                  </label>
                ))}
              </div>
              <NoticeText notice={message} />
            </div>
            </Modal>
          ) : null}
        </div>
      ) : null}
      {tab === "integrations" && integration ? (
        <Card key={`${integration.key}-${integration.enabled}-${integration.provider}-${integration.note}`}>
          <SectionNav items={(query.data?.integrations ?? []).map((item) => ({ id: item.key, label: item.label }))} value={integration.key} onChange={setIntegrationKey} />
          <form className="mt-4 space-y-3" onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await services.updateIntegration({
                key: integration.key,
                provider: String(data.get("provider") ?? ""),
                note: String(data.get("note") ?? ""),
                enabled: data.get("enabled") === "on",
              });
              setMessage("串接設定已更新");
              await client.invalidateQueries({ queryKey: ["access"] });
            } catch (error) {
              setMessage(failNotice(error instanceof ClientError ? error.message : "更新失敗"));
            }
          }}>
            <h2 className="text-xl">{integration.label}</h2>
            <Field label="服務方式"><TextInput name="provider" defaultValue={integration.provider} /></Field>
            <Field label="說明"><TextInput name="note" defaultValue={integration.note} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={integration.enabled} />啟用</label>
            <p className="text-sm text-[var(--muted)]">金流沒有服務商金鑰時不會扣款。</p>
            <Button type="submit">儲存這項串接</Button>
          </form>
        </Card>
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

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
