import { createContext } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type NotificationContextValue = {
  notify: (kind: "success" | "error" | "info", message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
