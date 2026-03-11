import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ReactNode } from "react";

interface ChoiceOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

interface ChoiceGridProps {
  options: ChoiceOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  columns?: 2 | 3;
}

export default function ChoiceGrid({
  options,
  value,
  onChange,
  multiSelect = false,
  columns = 2,
}: ChoiceGridProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const current = Array.isArray(value) ? value : [];
      const updated = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      onChange(updated);
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className={cn(
      "grid gap-3",
      columns === 2 ? "grid-cols-2" : "grid-cols-3"
    )}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all hover:border-primary/50",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:bg-accent/30"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            {option.icon && (
              <div className="text-muted-foreground">{option.icon}</div>
            )}
            <span className={cn(
              "text-sm font-medium",
              isSelected ? "text-foreground" : "text-muted-foreground"
            )}>
              {option.label}
            </span>
            {option.description && (
              <span className="text-xs text-muted-foreground">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
