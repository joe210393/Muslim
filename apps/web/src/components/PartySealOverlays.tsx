import { normalizeSealLayout, type SealLayout } from "@mf/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useServices } from "../app/session";
import { ClientError } from "../services/types";

export type PartySealUrls = Partial<SealLayout> & {
  companySealUrl?: string | null;
  personSealUrl?: string | null;
};

type HostBox = { left: number; top: number; width: number; height: number };

type Props = {
  /** 內含立約方 DOM、且需 position:relative 的容器 */
  rootRef: RefObject<HTMLElement | null>;
  seals?: PartySealUrls | null;
  editable?: boolean;
  /** 內容變更時重算位置 */
  watchKey?: string;
  onStatus?: (status: { saving: boolean; message: string }) => void;
};

/**
 * 把大小章疊在甲方欄位上。editable 時可拖曳，放開後寫入 seal settings。
 * 疊加層必須在 ProseMirror 外，避免編輯器重繪清掉節點。
 */
export function PartySealOverlays({ rootRef, seals, editable = false, watchKey = "", onStatus }: Props) {
  const services = useServices();
  const client = useQueryClient();
  const layoutRef = useRef<SealLayout>(normalizeSealLayout(seals));
  const [layout, setLayout] = useState<SealLayout>(() => normalizeSealLayout(seals));
  const [host, setHost] = useState<HostBox | null>(null);
  const [dragging, setDragging] = useState<"company" | "person" | null>(null);
  const grabRef = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    const next = normalizeSealLayout(seals);
    layoutRef.current = next;
    setLayout(next);
  }, [seals?.companySealX, seals?.companySealY, seals?.personSealX, seals?.personSealY]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const col = root.querySelector<HTMLElement>('.contract-parties-col[data-party="a"]');
        if (!col) {
          setHost(null);
          return;
        }
        col.classList.add("contract-parties-col--seal-host");
        col.classList.toggle("is-editable", editable);
        const rootRect = root.getBoundingClientRect();
        const colRect = col.getBoundingClientRect();
        setHost({
          left: colRect.left - rootRect.left + root.scrollLeft,
          top: colRect.top - rootRect.top + root.scrollTop,
          width: colRect.width,
          height: colRect.height,
        });
      });
    };

    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(root);
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(measure)
        : null;
    mo?.observe(root, { childList: true, subtree: true, characterData: true });
    root.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const timer = window.setTimeout(measure, 80);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.clearTimeout(timer);
    };
  }, [rootRef, editable, watchKey]);

  useEffect(() => {
    if (!editable || !dragging || !host) return;
    const root = rootRef.current;
    if (!root) return;

    const onMove = (event: PointerEvent) => {
      const rootRect = root.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((event.clientX - grabRef.current.dx - rootRect.left - host.left) / Math.max(host.width, 1)) * 100));
      const y = Math.min(100, Math.max(0, ((event.clientY - grabRef.current.dy - rootRect.top - host.top) / Math.max(host.height, 1)) * 100));
      const next =
        dragging === "person"
          ? { ...layoutRef.current, personSealX: x, personSealY: y }
          : { ...layoutRef.current, companySealX: x, companySealY: y };
      layoutRef.current = next;
      setLayout(next);
    };
    const onUp = () => {
      setDragging(null);
      const current = normalizeSealLayout(layoutRef.current);
      onStatus?.({ saving: true, message: "" });
      void services
        .updateSealPositions(current)
        .then(async () => {
          await client.invalidateQueries({ queryKey: ["contract-seals"] });
          onStatus?.({ saving: false, message: "大小章位置已儲存，下載 PDF 會套用。" });
        })
        .catch((error) => {
          onStatus?.({
            saving: false,
            message: error instanceof ClientError ? error.message : "無法儲存印章位置",
          });
        });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [editable, dragging, host, services, client, rootRef, onStatus]);

  if (!host) return null;

  const place = (kind: "company" | "person") => {
    const isCompany = kind === "company";
    const size = isCompany ? 88 : 61;
    const x = isCompany ? layout.companySealX : layout.personSealX;
    const y = isCompany ? layout.companySealY : layout.personSealY;
    const url = isCompany ? seals?.companySealUrl : seals?.personSealUrl;
    const style = {
      left: host.left + (host.width * x) / 100,
      top: host.top + (host.height * y) / 100,
      width: size,
      height: size,
    };
    const className = `contract-seal-overlay pointer-events-auto ${isCompany ? "is-company" : "is-person"}${
      dragging === kind ? " is-dragging" : ""
    }`;
    const onDown = (event: ReactPointerEvent) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      const box = event.currentTarget.getBoundingClientRect();
      grabRef.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
      setDragging(kind);
    };
    if (url) {
      return (
        <img
          key={kind}
          src={url}
          alt={isCompany ? "公司大章" : "負責人小章"}
          draggable={false}
          className={className}
          style={style}
          onPointerDown={onDown}
        />
      );
    }
    return (
      <span key={kind} className={className} style={style} onPointerDown={onDown}>
        {isCompany ? "公司大章" : "負責人小章"}
      </span>
    );
  };

  return (
    <div className="contract-seal-layer pointer-events-none absolute inset-0 z-10" aria-hidden={!editable}>
      {place("company")}
      {place("person")}
    </div>
  );
}

export function PartySealOverlaysConnected(props: Omit<Props, "seals">) {
  const services = useServices();
  const seals = useQuery({ queryKey: ["contract-seals"], queryFn: () => services.contractSeals() });
  return <PartySealOverlays {...props} seals={seals.data} />;
}
