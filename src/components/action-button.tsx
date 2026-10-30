"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/app/actions";

/** Tlačítko, které zavolá server action, ukáže toast a obnoví data stránky. */
export function ActionButton({
  action,
  children,
  pendingText,
  variant = "default",
  size = "default",
  disabled,
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  pendingText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res.ok) toast.success(res.message ?? "Hotovo");
          else toast.error(res.error);
          router.refresh();
        });
      }}
    >
      {pending && <Loader2Icon className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
