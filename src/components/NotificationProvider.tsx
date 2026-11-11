import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  NotificationContext,
  type ConfirmOptions,
} from "./notificationContext";

type NotificationItem = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

function Toast({
  notification,
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(notification.id),
      notification.kind === "error" ? 6000 : 4200
    );
    return () => window.clearTimeout(timer);
  }, [notification.id, notification.kind, onDismiss]);

  const Icon =
    notification.kind === "success"
      ? CheckCircle2
      : notification.kind === "error"
        ? AlertCircle
        : Info;
  const colors =
    notification.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : notification.kind === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-blue-200 bg-blue-50 text-blue-900";

  return (
    <div
      role={notification.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl ${colors}`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        {notification.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
      >
        <X size={17} />
      </button>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const nextId = useRef(0);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const notify = useCallback((kind: NotificationItem["kind"], message: string) => {
    const id = ++nextId.current;
    setNotifications((current) => [...current, { id, kind, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setConfirmation(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setConfirmation(null);
  }, []);

  useEffect(() => {
    if (confirmation) cancelButtonRef.current?.focus();
  }, [confirmation]);

  const value = useMemo(
    () => ({ notify, confirm }),
    [notify, confirm]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div
        aria-label="Notificaciones"
        className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(92vw,400px)] flex-col gap-3"
      >
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={dismiss}
          />
        ))}
      </div>

      {confirmation && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              resolveConfirmation(false);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirmation-title"
            aria-describedby="app-confirmation-message"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                resolveConfirmation(false);
              }
            }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="app-confirmation-title"
              className="text-lg font-black text-[#142C4E]"
            >
              {confirmation.title ?? "¿Estás seguro?"}
            </h2>
            <p
              id="app-confirmation-message"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {confirmation.message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => resolveConfirmation(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {confirmation.cancelLabel ?? "Seguir editando"}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirmation(true)}
                className="rounded-xl bg-[#10489f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#142C4E]"
              >
                {confirmation.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
