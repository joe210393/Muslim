import { CONTRACT_FIELD_DEFS, ensureContractHtml } from "@mf/contracts";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import { EditorContent, Node, mergeAttributes, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { PartySealOverlaysConnected } from "./PartySealOverlays";
import { BlockFormatting, FieldInsertTools, FontSize, FormattingTools, shouldReplaceEditorContent, toggleHeadingKeepingFormat } from "./richTextFormatting";

const ContractField = Node.create({
  name: "contractField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      key: { default: "siteName" },
      label: { default: "驗證場域名稱" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-contract-field]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const key = el.getAttribute("data-contract-field") || "siteName";
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

const ContractSeal = Node.create({
  name: "contractSeal",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: "company" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-contract-seal]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const kind = el.getAttribute("data-contract-seal") === "person" ? "person" : "company";
          return { kind };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const kind = node.attrs.kind === "person" ? "person" : "company";
    return [
      "span",
      mergeAttributes({
        "data-contract-seal": kind,
        class: "contract-seal",
        contenteditable: "false",
      }),
      kind === "company" ? "公司大章" : "負責人小章",
    ];
  },
});

const ContractPartiesCol = Node.create({
  name: "contractPartiesCol",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      party: {
        default: "a",
        parseHTML: (element) => (element.getAttribute("data-party") === "b" ? "b" : "a"),
        renderHTML: (attributes) => ({ "data-party": attributes.party === "b" ? "b" : "a" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div.contract-parties-col" }, { tag: "div[data-party]" }];
  },
  renderHTML({ node }) {
    return [
      "div",
      {
        class: "contract-parties-col",
        "data-party": node.attrs.party === "b" ? "b" : "a",
      },
      0,
    ];
  },
});

const ContractPartiesGrid = Node.create({
  name: "contractPartiesGrid",
  group: "block",
  content: "contractPartiesCol+",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "div.contract-parties-grid" }];
  },
  renderHTML() {
    return ["div", { class: "contract-parties-grid" }, 0];
  },
});

const ContractParties = Node.create({
  name: "contractParties",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'section[data-contract-parties="true"]' }, { tag: "section.contract-parties" }];
  },
  renderHTML() {
    return ["section", { "data-contract-parties": "true", class: "contract-parties" }, 0];
  },
});

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** 切換範本／版本時改變，用來重載內容；打字時不要變，否則游標會跳走。 */
  contentKey?: string;
  placeholder?: string;
};

function partiesInsertContent() {
  return {
    type: "contractParties",
    content: [
      {
        type: "paragraph",
        attrs: { class: "contract-parties-title" },
        content: [{ type: "text", text: "立約方", marks: [{ type: "bold" }] }],
      },
      {
        type: "contractPartiesGrid",
        content: [
          {
            type: "contractPartiesCol",
            attrs: { party: "a" },
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "甲方：伊斯蘭商務發展有限公司" },
                  { type: "contractSeal", attrs: { kind: "company" } },
                ],
              },
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "負責人：簡佩平" },
                  { type: "contractSeal", attrs: { kind: "person" } },
                ],
              },
              { type: "paragraph", content: [{ type: "text", text: "統編：91001128" }] },
              { type: "paragraph", content: [{ type: "text", text: "地址：宜蘭縣宜蘭市神農路一段1號" }] },
            ],
          },
          {
            type: "contractPartiesCol",
            attrs: { party: "b" },
            content: [
              { type: "paragraph", content: [{ type: "text", text: "乙方：" }] },
              { type: "paragraph", content: [{ type: "text", text: "負責人：" }] },
              { type: "paragraph", content: [{ type: "text", text: "統編：" }] },
              { type: "paragraph", content: [{ type: "text", text: "地址：" }] },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { class: "contract-parties-date" },
        content: [{ type: "text", text: "中華民國　　年　　月　　日" }],
      },
    ],
  };
}

export function ContractRichEditor({
  value,
  onChange,
  contentKey = "default",
  placeholder = "在此編排合約內容，可用工具列插入表格與可填欄位。",
}: Props) {
  const lastEmitted = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const shellRef = useRef<HTMLDivElement>(null);
  const [watchKey, setWatchKey] = useState(contentKey);
  const [sealStatus, setSealStatus] = useState({ saving: false, message: "" });
  const onSealStatus = useCallback((status: { saving: boolean; message: string }) => setSealStatus(status), []);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        BlockFormatting,
        FontSize,
        Underline,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        ContractField,
        ContractSeal,
        ContractPartiesCol,
        ContractPartiesGrid,
        ContractParties,
        Placeholder.configure({ placeholder }),
      ],
      content: ensureContractHtml(value || "<p></p>"),
      onUpdate: ({ editor: current }) => {
        const html = current.getHTML();
        lastEmitted.current = html;
        onChangeRef.current(html);
        setWatchKey(`${contentKey}:${current.state.doc.content.size}`);
      },
      editorProps: {
        attributes: {
          class: "contract-rich-editor prose max-w-none min-h-[28rem] px-3 py-2 focus:outline-none",
        },
      },
    },
    [contentKey],
  );

  useEffect(() => {
    if (!editor) return;
    if (!shouldReplaceEditorContent(editor, value, lastEmitted.current, ensureContractHtml)) return;
    editor.commands.setContent(ensureContractHtml(value || "<p></p>"), { emitUpdate: false });
    lastEmitted.current = null;
    setWatchKey(`${contentKey}:reload`);
  }, [value, editor, contentKey]);

  if (!editor) return <p className="text-sm text-[var(--muted)]">編輯器載入中…</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--muted)]">
        立約方為左右對列。可直接拖曳甲方欄上的大小章調整蓋章位置。
        <span className="ml-1 text-[var(--ink)]" role="status">{sealStatus.saving ? "儲存中…" : sealStatus.message}</span>
      </p>
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] bg-[var(--panel)] p-2">
          <MarkButtons editor={editor} />
          <FormattingTools editor={editor} />
          <ToolbarButton label="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()} />
          <ToolbarButton label="加列" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <ToolbarButton label="加欄" onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <ToolbarButton label="刪列" onClick={() => editor.chain().focus().deleteRow().run()} />
          <ToolbarButton label="刪欄" onClick={() => editor.chain().focus().deleteColumn().run()} />
          <ToolbarButton label="刪表" onClick={() => editor.chain().focus().deleteTable().run()} />
          <FieldInsertTools editor={editor} fields={CONTRACT_FIELD_DEFS} />
          <ToolbarButton label="立約方區塊" onClick={() => editor.chain().focus().insertContent(partiesInsertContent()).run()} />
        </div>
        <div ref={shellRef} className="contract-rich-editor-shell relative">
          <EditorContent editor={editor} />
          <PartySealOverlaysConnected rootRef={shellRef} editable watchKey={watchKey} onStatus={onSealStatus} />
        </div>
      </div>
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
      bulletList: Boolean(current?.isActive("bulletList")),
    }),
  });
  return (
    <>
      <ToolbarButton label="標題" onClick={() => toggleHeadingKeepingFormat(editor, 2)} active={active?.heading} />
      <ToolbarButton label="粗體" onClick={() => editor.chain().focus().toggleBold().run()} active={active?.bold} />
      <ToolbarButton label="底線" onClick={() => editor.chain().focus().toggleUnderline().run()} active={active?.underline} />
      <ToolbarButton label="項目" onClick={() => editor.chain().focus().toggleBulletList().run()} active={active?.bulletList} />
    </>
  );
}

function ToolbarButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" className={`btn rounded px-2 py-1 text-sm ${active ? "is-selected" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}
