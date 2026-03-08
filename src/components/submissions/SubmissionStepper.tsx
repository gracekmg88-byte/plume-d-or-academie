import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description: string;
}

interface SubmissionStepperProps {
  steps: Step[];
  currentStep: number;
}

export function SubmissionStepper({ steps, currentStep }: SubmissionStepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary scale-110",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 mt-[-1.5rem]">
                  <div
                    className={cn(
                      "h-0.5 rounded-full transition-all duration-500",
                      index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
