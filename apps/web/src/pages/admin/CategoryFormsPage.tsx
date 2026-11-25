import type { CategoryDefinition, CategoryField, AttachmentRequirement } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServices } from "../../app/session";
import { AdminPageHeader, Button, Card, ErrorText, Field, NoticeText, SelectInput, TextInput, confirmDelete, failNotice, type Notice } from "../../components/ui";
import { ClientError } from "../../services/types";

const INPUT_TYPES: Array<{ value: CategoryField["inputType"]; label: string }> = [
  { value: "text", label: "單行文字" },
  { value: "textarea", label: "多行文字" },
  { value: "select", label: "選項" },
  { value: "date", label: "日期" },
  { value: "number", label: "數字" },
  { value: "checkbox", label: "勾選" },
];

function nextFieldKey(fields: { key: string }[]) {
  let index = 1;
  while (fields.some((field) => field.key === `customField${index}`)) index += 1;
  return `customField${index}`;
}

function nextAttachmentKey(items: { key: string }[]) {
  let index = 1;
  while (items.some((item) => item.key === `custom_file_${index}`)) index += 1;
  return `custom_file_${index}`;
}

function withInputType(field: CategoryField, inputType: CategoryField["inputType"]): CategoryField {
  if (inputType === "select") {
    return { ...field, inputType, options: field.options?.length ? field.options : [{ value: "option1", label: "選項一" }] };
  }
  const { options: _removed, ...rest } = field;
  return { ...rest, inputType };
}

export function CategoryFormsPage() {
  const services = useServices();
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => services.categories() });
  const [categoryId, setCategoryId] = useState("");
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [published, setPublished] = useState<CategoryDefinition | null>(null);
  const [definition, setDefinition] = useState<CategoryDefinition | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const first = categories.data?.[0]?.id;
    if (first && !categoryId) setCategoryId(first);
  }, [categories.data, categoryId]);

  const form = useQuery({
    queryKey: ["category-form", categoryId],
    queryFn: () => services.categoryForm(categoryId),
    enabled: Boolean(categoryId),
  });

  useEffect(() => {
    if (!form.data || form.data.categoryId !== categoryId) return;
    setPublishedVersion(form.data.publishedVersion);
    setPublished(structuredClone(form.data.publishedDefinition));
    setDefinition(structuredClone(form.data.draftDefinition ?? form.data.publishedDefinition));
    setHasDraft(form.data.draftDefinition != null);
  }, [form.data, categoryId]);

  if (categories.isLoading || (categoryId && form.isLoading && !definition)) return <p>載入中…</p>;
  if (!categories.data?.length) return <ErrorText message="沒有申請類別" />;
  if (form.isError || !definition || !published) return <ErrorText message={form.error instanceof ClientError ? form.error.message : "無法載入表單"} />;

  const unchanged = JSON.stringify(definition) === JSON.stringify(published);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="表單欄位"
        description="每個類別可以自己加欄位、刪欄位、改附件。儲存草稿不會影響已經建立的申請。按正式完成後，之後新建立的申請，以及續約另開的申請，才使用這一版。舊案件維持原本的版本。"
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => void persist("draft")}>儲存草稿</Button>
            <Button disabled={busy || unchanged} onClick={() => void persist("publish")}>正式完成</Button>
          </>
        }
      />
      <NoticeText notice={notice} />
      <Field label="申請類別">
        <SelectInput aria-label="申請類別" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setNotice(null); }}>
          {categories.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectInput>
      </Field>
      <p className="text-sm text-[var(--muted)]">
        目前正式版本第 {publishedVersion} 版。
        {hasDraft ? "這一頁有尚未正式完成的修改，已建立的申請仍用正式版本。" : "目前沒有尚未完成的草稿。"}
        {unchanged ? " 內容和正式版本相同。" : ""}
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">欄位</h2>
        {definition.fields.map((field, index) => (
          <Card key={field.key}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="欄位名稱" required>
                <TextInput value={field.label} onChange={(event) => updateField(index, { ...field, label: event.target.value })} />
              </Field>
              <Field label="填寫方式">
                <SelectInput aria-label={`${field.label}的填寫方式`} value={field.inputType} onChange={(event) => updateField(index, withInputType(field, event.target.value as CategoryField["inputType"]))}>
                  {INPUT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="說明">
                <TextInput value={field.helpText ?? ""} onChange={(event) => updateField(index, { ...field, helpText: event.target.value || undefined })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={field.requiredOnSubmit} onChange={(event) => updateField(index, { ...field, requiredOnSubmit: event.target.checked })} />
                送件時必填
              </label>
            </div>
            {field.inputType === "select" ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">選項</p>
                {(field.options ?? []).map((option, optionIndex) => (
                  <div key={`${field.key}-${optionIndex}`} className="flex flex-wrap gap-2">
                    <TextInput aria-label="選項文字" value={option.label} onChange={(event) => updateOption(index, optionIndex, event.target.value)} />
                    <Button variant="secondary" type="button" onClick={() => removeOption(index, optionIndex)}>移除選項</Button>
                  </div>
                ))}
                <Button variant="secondary" type="button" onClick={() => addOption(index)}>新增選項</Button>
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">代碼 {field.key}</p>
              <Button variant="danger" type="button" onClick={() => removeField(index, field.label)}>刪除欄位</Button>
            </div>
          </Card>
        ))}
        <Button type="button" onClick={addField}>新增欄位</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">附件</h2>
        <p className="text-sm text-[var(--muted)]">文件可以上傳 PDF、照片和影片。只限照片的欄位不接受影片。單檔大小在管理的設定頁調整。</p>
        {definition.attachmentRequirements.map((item, index) => (
          <Card key={item.key}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="附件名稱" required>
                <TextInput value={item.label} onChange={(event) => updateAttachment(index, { ...item, label: event.target.value })} />
              </Field>
              <Field label="接受的檔案">
                <SelectInput aria-label={`${item.label}接受的檔案`} value={item.accept} onChange={(event) => updateAttachment(index, { ...item, accept: event.target.value as AttachmentRequirement["accept"] })}>
                  <option value="file">文件（PDF、照片、影片）</option>
                  <option value="image">只限照片</option>
                </SelectInput>
              </Field>
              <Field label="說明">
                <TextInput value={item.helpText ?? ""} onChange={(event) => updateAttachment(index, { ...item, helpText: event.target.value || undefined })} />
              </Field>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={item.requiredOnSubmit} onChange={(event) => updateAttachment(index, { ...item, requiredOnSubmit: event.target.checked })} />
                  送件時必附
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={item.multiple} onChange={(event) => updateAttachment(index, { ...item, multiple: event.target.checked })} />
                  可上傳多個檔案
                </label>
              </div>
            </div>
            {item.group === "checklist" ? <p className="mt-2 text-xs text-[var(--muted)]">這是檢核項目，業者申請頁不會把它當成上傳欄。</p> : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">代碼 {item.key}</p>
              <Button variant="danger" type="button" onClick={() => removeAttachment(index, item.label)}>刪除附件</Button>
            </div>
          </Card>
        ))}
        <Button type="button" onClick={addAttachment}>新增附件</Button>
      </section>
    </div>
  );

  function updateField(index: number, field: CategoryField) {
    setDefinition((current) => current && { ...current, fields: current.fields.map((item, itemIndex) => itemIndex === index ? field : item) });
  }

  function updateOption(fieldIndex: number, optionIndex: number, label: string) {
    setDefinition((current) => {
      if (!current) return current;
      const field = current.fields[fieldIndex];
      if (!field?.options) return current;
      const options = field.options.map((option, index) => index === optionIndex ? { ...option, label } : option);
      return { ...current, fields: current.fields.map((item, index) => index === fieldIndex ? { ...field, options } : item) };
    });
  }

  function addOption(fieldIndex: number) {
    setDefinition((current) => {
      if (!current) return current;
      const field = current.fields[fieldIndex];
      if (!field) return current;
      const options = [...(field.options ?? [])];
      const value = `option${options.length + 1}`;
      options.push({ value, label: `選項${options.length + 1}` });
      return { ...current, fields: current.fields.map((item, index) => index === fieldIndex ? { ...field, options } : item) };
    });
  }

  function removeOption(fieldIndex: number, optionIndex: number) {
    setDefinition((current) => {
      if (!current) return current;
      const field = current.fields[fieldIndex];
      if (!field?.options || field.options.length <= 1) return current;
      const options = field.options.filter((_, index) => index !== optionIndex);
      return { ...current, fields: current.fields.map((item, index) => index === fieldIndex ? { ...field, options } : item) };
    });
  }

  function addField() {
    setDefinition((current) => {
      if (!current) return current;
      const field: CategoryField = { key: nextFieldKey(current.fields), label: "新欄位", inputType: "text", requiredOnSubmit: false };
      return { ...current, fields: [...current.fields, field] };
    });
  }

  function removeField(index: number, label: string) {
    if (!confirmDelete(label || "這個欄位")) return;
    setDefinition((current) => current && { ...current, fields: current.fields.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateAttachment(index: number, item: AttachmentRequirement) {
    setDefinition((current) => current && { ...current, attachmentRequirements: current.attachmentRequirements.map((entry, itemIndex) => itemIndex === index ? item : entry) });
  }

  function addAttachment() {
    setDefinition((current) => {
      if (!current) return current;
      const item: AttachmentRequirement = {
        key: nextAttachmentKey(current.attachmentRequirements),
        label: "新附件",
        requiredOnSubmit: false,
        accept: "file",
        multiple: true,
        group: "application",
      };
      return { ...current, attachmentRequirements: [...current.attachmentRequirements, item] };
    });
  }

  function removeAttachment(index: number, label: string) {
    if (!confirmDelete(label || "這個附件")) return;
    setDefinition((current) => current && { ...current, attachmentRequirements: current.attachmentRequirements.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function persist(mode: "draft" | "publish") {
    if (!definition || !categoryId) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "draft") {
        await services.saveCategoryFormDraft(categoryId, definition);
        setNotice("草稿已儲存。已建立的申請仍用目前正式版本。");
      } else {
        const publishedForm = await services.publishCategoryForm(categoryId, definition);
        setNotice(`已正式完成，新版本是第 ${publishedForm.version} 版。之後新申請和續約會使用這一版。`);
      }
      await client.invalidateQueries({ queryKey: ["category-form", categoryId] });
      await client.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      setNotice(failNotice(error instanceof ClientError ? error.message : "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }
}
