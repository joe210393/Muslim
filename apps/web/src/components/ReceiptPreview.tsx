import { useEffect, useState } from "react";
import { useServices } from "../app/session";
import { ClientError } from "../services/types";
import { ErrorText, Modal } from "./ui";

export function ReceiptPreview({ paymentId, title, onClose }: { paymentId: string; title: string; onClose: () => void }) {
  const services = useServices();
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void services.paymentReceipt(paymentId).then((downloaded) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(downloaded.blob);
      setFile({ url: objectUrl, type: downloaded.blob.type });
    }).catch((reason) => {
      if (active) setError(reason instanceof ClientError ? reason.message : "無法開啟單據");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paymentId, services]);
  return (
    <Modal title={title} onClose={onClose} wide>
      {error ? <ErrorText message={error} /> : !file ? <p className="text-sm text-[var(--muted)]">載入單據中…</p> : file.type.startsWith("image/") ? (
        <img src={file.url} alt={title} className="mx-auto max-h-[70vh] max-w-full rounded-md border border-[var(--line)] bg-white object-contain" />
      ) : (
        <iframe title={title} src={file.url} className="h-[70vh] w-full rounded-md border border-[var(--line)] bg-white" />
      )}
    </Modal>
  );
}
