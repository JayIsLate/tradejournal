'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue = 5, min = 1, max = 10, step = 1, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = value !== undefined ? value : internalValue

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value)
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    const percentage = ((currentValue - min) / (max - min)) * 100

    return (
      <div className={cn('relative flex w-full items-center', className)}>
        <input
          type="range"
          ref={ref}
          value={currentValue}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          className="w-full h-2 bg-secondary appearance-none cursor-pointer accent-primary"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${percentage}%, hsl(var(--secondary)) ${percentage}%)`,
          }}
          {...props}
        />
        <span className="ml-3 text-sm font-medium text-foreground min-w-[2rem] text-center">
          {currentValue}
        </span>
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
