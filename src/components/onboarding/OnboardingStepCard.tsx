import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingStepCardProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}

export default function OnboardingStepCard({
  stepIndex,
  totalSteps,
  title,
  description,
  icon,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
}: OnboardingStepCardProps) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {stepIndex + 1} of {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="text-center space-y-3">
          {icon && (
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              {icon}
            </div>
          )}
          <CardTitle className="text-xl text-foreground">{title}</CardTitle>
          {description && (
            <CardDescription className="text-muted-foreground">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {children}

          <div className="flex gap-3 pt-2">
            {onBack && (
              <Button variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            {onNext && (
              <Button
                onClick={onNext}
                disabled={nextDisabled || loading}
                className="flex-1"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Creating...</>
                ) : (
                  <>{nextLabel} <ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
