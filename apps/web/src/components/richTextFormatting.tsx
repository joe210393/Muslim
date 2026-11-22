import { FONT_SIZE_OPTIONS_PT, normalizeFontSizePt, normalizeTextAlign, type TextAlignValue } from "@mf/contracts";
import { Extension, Mark, useEditorState, type Editor } from "@tiptap/react";
import { useState } from "react";

/** 段落／標題保留 class（官方版式用）與對齊；轉成標題時由工具列帶過去。 */
export const BlockFormatting = Extension.create({
  name: "blockFormatting",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          class: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("class"),
            renderHTML: (attributes: { class?: string | null }) => (attributes.class ? { class: attributes.class } : {}),
          },
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              normalizeTextAlign(element.style.textAlign)
              ?? (element.classList.contains("certificate-center") ? "center" : null),
            renderHTML: (attributes: { textAlign?: string | null }) => {
              const align = normalizeTextAlign(attributes.textAlign);
              return align ? { style: `text-align: ${align}` } : {};
            },
          },
        },
      },
    ];
  },
});

/** 字級（pt）：可套在文字與可填欄位上。 */
export const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeFontSizePt(element.style.fontSize),
        renderHTML: (attributes: { size?: number | null }) => {
          const size = normalizeFontSizePt(attributes.size);
          return size ? { style: `font-size: ${size}pt` } : {};
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => (element instanceof HTMLElement && normalizeFontSizePt(element.style.fontSize) ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

const ALIGN_OPTIONS: Array<{ value: TextAlignValue; label: string }> = [
  { value: "left", label: "靠左" },
  { value: "center", label: "置中" },
  { value: "right", label: "靠右" },
  { value: "justify", label: "左右對齊" },
];

function currentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "paragraph" || node.type.name === "heading") return node;
  }
  return null;
}

/** 轉成標題／段落時保留對齊與 class，避免置中文字跑回最前面。 */
export function toggleHeadingKeepingFormat(editor: Editor, level: 2 | 3) {
  const block = currentBlock(editor);
  const attrs = { level, textAlign: block?.attrs.textAlign ?? null, class: block?.attrs.class ?? null };
  editor.chain().focus().toggleHeading(attrs as { level: 2 | 3 }).run();
}

export function setBlockAlign(editor: Editor, align: TextAlignValue) {
  editor.chain().focus().updateAttributes("paragraph", { textAlign: align }).updateAttributes("heading", { textAlign: align }).run();
}

export function insertFieldWithSize(editor: Editor, key: string, label: string, sizePt: number | null) {
  const marks = sizePt ? [{ type: "fontSize", attrs: { size: sizePt } }] : [];
  editor.chain().focus().insertContent({ type: "contractField", attrs: { key, label }, marks }).run();
}

/** 對齊＋字級工具列（合約、證書共用）。 */
export function FormattingTools({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current || current.isDestroyed) return { align: null as TextAlignValue | null, size: null as number | null };
      const block = currentBlock(current);
      const align = normalizeTextAlign(block?.attrs.textAlign) ?? "left";
      const size = normalizeFontSizePt(current.getAttributes("fontSize").size);
      return { align, size };
    },
  });
  return (
    <>
      <span className="inline-flex overflow-hidden rounded border border-[var(--line)]" role="group" aria-label="對齊">
        {ALIGN_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`btn rounded-none px-2 py-1 text-sm ${state?.align === item.value ? "is-selected" : ""}`}
            onClick={() => setBlockAlign(editor, item.value)}
          >
            {item.label}
          </button>
        ))}
      </span>
      <label className="inline-flex items-center gap-1 text-sm">
        <span className="text-[var(--muted)]">字級</span>
        <select
          className="rounded border border-[var(--line)] bg-white px-2 py-1"
          value={state?.size ? String(state.size) : ""}
          onChange={(event) => {
            const size = Number(event.target.value);
            if (size) editor.chain().focus().setMark("fontSize", { size: normalizeFontSizePt(size) }).run();
            else editor.chain().focus().unsetMark("fontSize").run();
          }}
        >
          <option value="">預設</option>
          {FONT_SIZE_OPTIONS_PT.map((size) => (
            <option key={size} value={size}>{size} pt</option>
          ))}
        </select>
      </label>
    </>
  );
}

/** 插入可填欄位；可先指定該欄位字級。已插入的欄位點選後也可用「字級」調整。 */
export function FieldInsertTools({
  editor,
  fields,
}: {
  editor: Editor;
  fields: ReadonlyArray<{ key: string; label: string }>;
}) {
  const [fieldSize, setFieldSize] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm">
      <span className="text-[var(--muted)]">可填欄位</span>
      <select
        className="rounded border border-[var(--line)] bg-white px-2 py-1"
        aria-label="欄位字級"
        value={fieldSize}
        onChange={(event) => setFieldSize(event.target.value)}
      >
        <option value="">欄位字級：預設</option>
        {FONT_SIZE_OPTIONS_PT.map((size) => (
          <option key={size} value={size}>欄位字級：{size} pt</option>
        ))}
      </select>
      <select
        className="rounded border border-[var(--line)] bg-white px-2 py-1"
        aria-label="插入可填欄位"
        defaultValue=""
        onChange={(event) => {
          const key = event.target.value;
          event.target.value = "";
          const def = fields.find((item) => item.key === key);
          if (!def || editor.isDestroyed) return;
          insertFieldWithSize(editor, def.key, def.label, Number(fieldSize) || null);
        }}
      >
        <option value="">插入…</option>
        {fields.map((item) => (
          <option key={item.key} value={item.key}>{item.label}</option>
        ))}
      </select>
    </span>
  );
}

/**
 * 外部 value 與編輯器內容比對：只有真的不同才 setContent。
 * 兩邊都先正規化，避免清理後字串差異造成游標跳到最前面。
 */
export function shouldReplaceEditorContent(editor: Editor, value: string, lastEmitted: string | null, normalize: (html: string) => string) {
  if (editor.isDestroyed || editor.view.composing) return false;
  if (lastEmitted !== null && value === lastEmitted) return false;
  return normalize(value || "<p></p>") !== normalize(editor.getHTML());
}
