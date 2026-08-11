"use client";

import { useCallback, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description: string;
  consequences?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

export function useConfirmDialog() {
  const [opts, setOpts] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpts({ ...options, resolve });
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      open={opts != null}
      title={opts?.title ?? ""}
      description={opts?.description ?? ""}
      consequences={opts?.consequences}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      tone={opts?.tone}
      onCancel={() => {
        opts?.resolve(false);
        setOpts(null);
      }}
      onConfirm={() => {
        opts?.resolve(true);
        setOpts(null);
      }}
    />
  );

  return { confirm, dialog };
}
