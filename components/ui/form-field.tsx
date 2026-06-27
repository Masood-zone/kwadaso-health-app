import * as React from "react"

import { cn } from "@/lib/utils"

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-2", className)} {...props} />
}

function FormControl({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative", className)} {...props} />
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  if (!props.children) return null

  return (
    <p
      data-slot="form-message"
      className={cn("text-sm leading-5 text-destructive", className)}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="form-description"
      className={cn("text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  )
}

export { FormControl, FormDescription, FormItem, FormMessage }
