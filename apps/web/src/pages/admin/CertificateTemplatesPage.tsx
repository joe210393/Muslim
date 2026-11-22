import { ensureCertificateHtml, fillCertificateHtml, buildCertificateFillValues, findCertificateTemplateDef, layoutCertificateRowsHtml } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useServices } from "../../app/session";
import { CertificateRichEditor } from "../../components/CertificateRichEditor";
import { AdminPageHeader, Button, Empty, ErrorText, Field, Modal, SectionHeader, TextInput, NoticeText, failNotice, type Notice } from "../../components/ui";
import { ClientError } from "../../services/types";

const categoryLabels: Record<string, string> = {
  CAT_01: "穆斯林友善餐廳",
  CAT_02: "穆斯林友善產品",
  CAT_03: "穆斯林友善旅宿",
  CAT_04: "穆斯林友善商店",
  CAT_05: "穆斯林友善旅行社",
  CAT_06: "穆斯林友善環境",
  CAT_07: "穆斯林友善體驗活動",
};

type TemplateRow = Awaited<ReturnType<ReturnType<typeof useServices>["certificateTemplates"]>>[number];

export function CertificateTemplatesPage() {
  const services = useServices();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["certificate-templates"], queryFn: () => services.certificateTemplates() });
  const [editor, setEditor] = useState<TemplateRow | null>(null);
  const [preview, setPreview] = useState<TemplateRow | null>(null);
  const [message, setMessage] = useState<Notice>(null);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="證書範本"
        description="版式對齊官方證書 PDF：置中抬頭、Logo、業者與標題。各範本可上傳對應類別 Logo 與驗證單位簽名檔。"
      />
      <SectionHeader title="範本列表" hint="依申請類別／項目自動對應；核發時可再選。" />
      <NoticeText notice={message} />
      {query.isLoading ? <p>載入中…</p> : null}
      {query.error ? <ErrorText message={query.error instanceof ClientError ? query.error.message : "無法載入證書範本"} /> : null}
      {(query.data?.length ?? 0) === 0 ? <Empty title="尚未設定證書範本" body="" /> : null}
      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Logo</th>
              <th className="p-3 font-medium">簽名檔</th>
              <th className="p-3 font-medium">範本</th>
              <th className="p-3 font-medium">類別</th>
              <th className="p-3 font-medium">對應規則</th>
              <th className="p-3 font-medium">版本</th>
              <th className="p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((item) => (
              <tr key={item.key} className="border-t border-[var(--line)]">
                <td className="p-3">
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt="" className="h-14 w-14 object-contain" />
                  ) : (
                    <span className="text-[var(--muted)]">未上傳</span>
                  )}
                </td>
                <td className="p-3">
                  {item.signatureUrl ? (
                    <img src={item.signatureUrl} alt="" className="h-10 w-24 object-contain" />
                  ) : (
                    <span className="text-[var(--muted)]">未上傳</span>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">{item.titleZh}</p>
                  <p className="text-[var(--muted)]">{item.titleEn}</p>
                </td>
                <td className="p-3">{categoryLabels[item.categoryCode] ?? item.categoryCode}</td>
                <td className="p-3">{item.matchNote}</td>
                <td className="p-3">v{item.version}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="text-[var(--link)] underline" onClick={() => setEditor(item)}>編輯</button>
                    <button type="button" className="text-[var(--link)] underline" onClick={() => setPreview(item)}>預覽</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-[var(--muted)]">
        已核定案件發證時會套用對應範本、Logo 與簽名檔；下載證書時一律使用目前的簽名檔。
        {" "}
        <Link className="text-[var(--link)]" to="/admin/applications/approved">前往已核定</Link>
      </p>
      {editor ? (
        <CertificateTemplateEditorModal
          template={editor}
          onClose={() => setEditor(null)}
          onSaved={async (saved) => {
            setMessage(`已儲存「${saved.titleZh}」`);
            setEditor(saved);
            await client.invalidateQueries({ queryKey: ["certificate-templates"] });
          }}
          onMessage={setMessage}
        />
      ) : null}
      {preview ? <CertificatePreviewModal template={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function CertificateTemplateEditorModal({
  template,
  onClose,
  onSaved,
  onMessage,
}: {
  template: TemplateRow;
  onClose: () => void;
  onSaved: (saved: TemplateRow) => Promise<void>;
  onMessage: (message: Notice) => void;
}) {
  const services = useServices();
  const [titleZh, setTitleZh] = useState(template.titleZh);
  const [titleEn, setTitleEn] = useState(template.titleEn);
  const [body, setBody] = useState(ensureCertificateHtml(template.body));
  const [logoUrl, setLogoUrl] = useState(template.logoUrl);
  const [signatureUrl, setSignatureUrl] = useState(template.signatureUrl);
  const [expectedVersion, setExpectedVersion] = useState(template.version);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitleZh(template.titleZh);
    setTitleEn(template.titleEn);
    setBody(ensureCertificateHtml(template.body));
    setLogoUrl(template.logoUrl);
    setSignatureUrl(template.signatureUrl);
    setExpectedVersion(template.version);
  }, [template]);

  return (
    <Modal title={`編輯 ${template.titleZh}`} onClose={onClose} wide>
      <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
        <p className="text-sm text-[var(--muted)]">Logo 會出現在抬頭下方置中（同官方 PDF）。可換檔後再調內文欄位。</p>
        <ImageUploadField
          label="證書 Logo（此類型專用）"
          buttonLabel="上傳 Logo"
          imageUrl={logoUrl}
          imageClassName="h-24 w-24 object-contain"
          disabled={busy}
          onUpload={async (file) => {
            setBusy(true);
            try {
              const saved = await services.uploadCertificateLogo(template.key, file);
              setLogoUrl(saved.logoUrl);
              setExpectedVersion(saved.version);
              await onSaved(saved);
              onMessage("Logo 已更新");
            } catch (error) {
              onMessage(failNotice(error instanceof ClientError ? error.message : "Logo 上傳失敗"));
            } finally {
              setBusy(false);
            }
          }}
        />
        <ImageUploadField
          label="驗證單位簽名檔（放在「驗證單位」下方虛線上）"
          hint="建議透明背景 PNG。未上傳時使用預設簽名。"
          buttonLabel="上傳簽名檔"
          imageUrl={signatureUrl}
          imageClassName="h-20 w-48 object-contain"
          disabled={busy}
          onUpload={async (file) => {
            setBusy(true);
            try {
              const saved = await services.uploadCertificateSignature(template.key, file);
              setSignatureUrl(saved.signatureUrl);
              setExpectedVersion(saved.version);
              await onSaved(saved);
              onMessage("簽名檔已更新");
            } catch (error) {
              onMessage(failNotice(error instanceof ClientError ? error.message : "簽名檔上傳失敗"));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Field label="中文標題"><TextInput value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></Field>
        <Field label="英文標題"><TextInput value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></Field>
        <Field group label="內文排版">
          <CertificateRichEditor contentKey={template.key} value={body} onChange={setBody} />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !titleZh.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await services.saveCertificateTemplate(template.key, {
                  titleZh,
                  titleEn,
                  body: ensureCertificateHtml(body),
                  expectedVersion,
                });
                setExpectedVersion(saved.version);
                await onSaved(saved);
              } catch (error) {
                onMessage(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
              } finally {
                setBusy(false);
              }
            }}
          >
            儲存範本
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>關閉</Button>
        </div>
        <div className="border-t border-[var(--line)] pt-4">
          <h3 className="text-lg font-medium">預覽</h3>
          <CertificateBodyPreview body={body} logoUrl={logoUrl} signatureUrl={signatureUrl} />
        </div>
      </div>
    </Modal>
  );
}

function CertificatePreviewModal({ template, onClose }: { template: TemplateRow; onClose: () => void }) {
  return (
    <Modal title={`預覽 ${template.titleZh}`} onClose={onClose} wide>
      <CertificateBodyPreview body={template.body} logoUrl={template.logoUrl} signatureUrl={template.signatureUrl} />
    </Modal>
  );
}

function ImageUploadField({
  label,
  hint,
  buttonLabel,
  imageUrl,
  imageClassName,
  disabled,
  onUpload,
}: {
  label: string;
  hint?: string;
  buttonLabel: string;
  imageUrl: string | null;
  imageClassName: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <Field group label={label}>
      <div className="flex flex-wrap items-center gap-4">
        {imageUrl ? <img src={imageUrl} alt="" className={imageClassName} /> : <span className="text-sm text-[var(--muted)]">尚未上傳</span>}
        <label className="btn cursor-pointer rounded-md px-3 py-2 text-sm">
          {buttonLabel}
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            disabled={disabled}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) await onUpload(file);
            }}
          />
        </label>
        {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      </div>
    </Field>
  );
}

export function CertificateBodyPreview({
  body,
  logoUrl,
  signatureUrl,
  values,
}: {
  body: string;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  values?: Parameters<typeof fillCertificateHtml>[1];
}) {
  const filled = fillCertificateHtml(
    body,
    values
      ?? buildCertificateFillValues({
        organizationName: "快樂家旅行社有限公司",
        siteName: "快樂家旅行社有限公司",
        addressZh: "新北市板橋區翠華街6巷82號1樓",
        certificateNameEn: "HAPPY GO TRAVEL SERVICE LTD",
        certificateAddressEn: "1F., No. 82, Ln. 6, Cuihua St., Banqiao Dist., New Taipei City",
        certificatePhone: "+886-2-89611819",
        certificateNo: "ICD2025MFTA003",
        issuedOnDate: "2025/06/01",
        validUntilDate: "2026/05/31",
        template: findCertificateTemplateDef("MFTA_TRAVEL"),
      }),
    logoUrl,
    signatureUrl,
  );
  return (
    <div
      className="certificate-sheet contract-body-view mx-auto max-w-3xl border border-[var(--line)] bg-white text-sm"
      dangerouslySetInnerHTML={{ __html: layoutCertificateRowsHtml(filled) }}
    />
  );
}
