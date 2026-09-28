import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

// Segmented − [value] + control; the value stays directly editable
const NumberStepper: React.FC<NumberStepperProps> = ({
  value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, disabled, className, ...rest
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const btn =
    "flex h-full w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-primary active:bg-primary/10 disabled:pointer-events-none disabled:opacity-35"

  return (
    <div
      className={cn(
        "inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-input bg-card shadow-sm transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
        disabled && "opacity-50",
        className
      )}
    >
      <button type="button" className={btn} onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min} aria-label="Decrease">
        <Minus size={15} strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        onChange={e => {
          const digits = e.target.value.replace(/\D/g, "")
          onChange(clamp(digits === "" ? min : parseInt(digits, 10)))
        }}
        onKeyDown={e => {
          if (e.key === "ArrowUp") { e.preventDefault(); onChange(clamp(value + step)) }
          if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - step)) }
        }}
        className="w-12 border-x border-input bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max} aria-label="Increase">
        <Plus size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export { NumberStepper }
