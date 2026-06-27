import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-xs leading-4 font-semibold tracking-[0.05em] text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

export { Label }
