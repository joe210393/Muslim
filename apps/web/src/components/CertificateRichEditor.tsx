import { CERTIFICATE_FIELD_DEFS, ensureCertificateHtml } from "@mf/contracts";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, Node, mergeAttributes, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { BlockFormatting, FieldInsertTools, FontSize, FormattingTools, shouldReplaceEditorContent, toggleHeadingKeepingFormat } from "./richTextFormatting";

const CertificateField = Node.create({
  name: "contractField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      key: { default: "licenseeNameZh" },
      label: { default: "單位名稱（中文）" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-contract-field]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const key = el.getAttribute("data-contract-field") || "licenseeNameZh";
          return { key, label: el.textContent?.trim() || key };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({
        "data-contract-field": node.attrs.key,
        class: "contract-field",
      }),
      node.attrs.label || node.attrs.key,
    ];
  },
});

/** 保留官方 PDF 置中 Logo 槽位；atom 葉節點，不解析子內容。 */
const CertificateLogoSlot = Node.create({
  name: "certificateLogoSlot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  parseHTML() {
    return [
      {
        tag: "div[data-certificate-logo]",
        getAttrs: () => ({}),
      },
    ];
  },
  renderHTML() {
    return [
      "div",
      {
        "data-certificate-logo": "true",
        class: "certificate-logo-slot certificate-center",
      },
      "（Logo 位置）",
    ];
  },
  // 儲存／讀回時略過槽內 img／span，避免 atom 節點解析崩潰
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.setAttribute("data-certificate-logo", "true");
      dom.className = "certificate-logo-slot certificate-center";
      dom.textContent = "（Logo 位置）";
      return { dom, contentDOM: null };
    };
  },
});

/** 驗證單位簽名槽位（官方 PDF 虛線簽名）。 */
const CertificateSignatureSlot = Node.create({
  name: "certificateSignatureSlot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-certificate-signature]", getAttrs: () => ({}) }];
  },
  renderHTML() {
    return [
      "div",
      {
        "data-certificate-signature": "true",
        class: "certificate-signature-slot",
      },
      "（驗證單位簽名）",
    ];
  },
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.setAttribute("data-certificate-signature", "true");
      dom.className = "certificate-signature-slot";
      dom.textContent = "（驗證單位簽名）";
      return { dom, contentDOM: null };
    };
  },
});

type Props = {
  value: string;
  onChange: (html: string) => void;
  contentKey?: string;
};

export function CertificateRichEditor({ value, onChange, contentKey = "default" }: Props) {
  const lastEmitted = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        BlockFormatting,
        FontSize,
        Underline,
        CertificateField,
        CertificateLogoSlot,
        CertificateSignatureSlot,
        Placeholder.configure({ placeholder: "編排證書內容，可用工具列插入可填欄位。" }),
      ],
      content: ensureCertificateHtml(value || "<p></p>"),
      onUpdate: ({ editor: current }) => {
        if (current.isDestroyed) return;
        const html = current.getHTML();
        lastEmitted.current = html;
        onChangeRef.current(html);
      },
      editorProps: {
        attributes: {
          class: "contract-rich-editor prose max-w-none min-h-[22rem] px-3 py-2 focus:outline-none",
        },
      },
    },
    // 只依範本鍵重建；版本變更用 setContent，避免儲存後 destroy 崩潰
    [contentKey],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!shouldReplaceEditorContent(editor, value, lastEmitted.current, ensureCertificateHtml)) return;
    editor.commands.setContent(ensureCertificateHtml(value || "<p></p>"), { emitUpdate: false });
    lastEmitted.current = null;
  }, [value, editor]);

  if (!editor || editor.isDestroyed) {
    return <p className="text-sm text-[var(--muted)]">編輯器載入中…</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] p-2">
        <MarkButtons editor={editor} />
        <FormattingTools editor={editor} />
        <FieldInsertTools editor={editor} fields={CERTIFICATE_FIELD_DEFS} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function MarkButtons({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: Boolean(current?.isActive("heading", { level: 2 })),
      bold: Boolean(current?.isActive("bold")),
      underline: Boolean(current?.isActive("underline")),
    }),
  });
  return (
    <>
      <button type="button" className={`btn rounded px-2 py-1 text-sm ${active?.heading ? "is-selected" : ""}`} onClick={() => toggleHeadingKeepingFormat(editor, 2)}>標題</button>
      <button type="button" className={`btn rounded px-2 py-1 text-sm ${active?.bold ? "is-selected" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()}>粗體</button>
      <button type="button" className={`btn rounded px-2 py-1 text-sm ${active?.underline ? "is-selected" : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>底線</button>
    </>
  );
}
