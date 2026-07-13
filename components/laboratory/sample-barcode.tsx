"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

import { Button } from "@/components/ui/button"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"

export function SampleBarcode({ value, patientName, sampleType }: { value: string; patientName: string; sampleType: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", displayValue: true, height: 58, margin: 8, fontSize: 14 })
  }, [value])
  return (
    <div className="khms-card print-label p-4 text-center">
      <p className="khms-label">KHIP Laboratory Sample</p>
      <svg ref={ref} className="mx-auto mt-2 max-w-full" aria-label={`Barcode for ${value}`} />
      <p className="text-sm font-semibold">{patientName}</p>
      <p className="text-xs text-muted-foreground">{sampleType}</p>
      <Button
        type="button"
        className="mt-3 print:hidden"
        variant="outline"
        onClick={() => {
          document.body.classList.add("printing-label")
          window.addEventListener("afterprint", () => document.body.classList.remove("printing-label"), { once: true })
          window.print()
        }}
      >
        <MaterialSymbol icon="print" className="text-lg" /> Print label
      </Button>
    </div>
  )
}
