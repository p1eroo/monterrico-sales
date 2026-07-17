import type { ReactNode } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function ToastIconBadge({
  children,
  variant,
}: {
  children: ReactNode
  variant: "success" | "error" | "warning" | "info" | "loading"
}) {
  return (
    <span className={`crm-toast__icon-badge crm-toast__icon-badge--${variant}`}>
      {children}
    </span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      expand={false}
      duration={4000}
      gap={12}
      visibleToasts={1}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "crm-toast",
          title: "crm-toast__title",
          description: "crm-toast__description",
          closeButton: "crm-toast__close",
          icon: "crm-toast__icon",
          content: "crm-toast__content",
        },
      }}
      icons={{
        success: (
          <ToastIconBadge variant="success">
            <CircleCheckIcon className="size-4 text-primary" strokeWidth={2.25} />
          </ToastIconBadge>
        ),
        info: (
          <ToastIconBadge variant="info">
            <InfoIcon className="size-4 text-info" strokeWidth={2.25} />
          </ToastIconBadge>
        ),
        warning: (
          <ToastIconBadge variant="warning">
            <TriangleAlertIcon className="size-4 text-warning" strokeWidth={2.25} />
          </ToastIconBadge>
        ),
        error: (
          <ToastIconBadge variant="error">
            <OctagonXIcon className="size-4 text-destructive" strokeWidth={2.25} />
          </ToastIconBadge>
        ),
        loading: (
          <ToastIconBadge variant="loading">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" strokeWidth={2.25} />
          </ToastIconBadge>
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }
