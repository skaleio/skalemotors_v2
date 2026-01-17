import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export function EmptyStatePage(props: { title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  const { title, description, actionLabel, onAction } = props;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-12 pb-12">
          <div className="text-center max-w-md mx-auto">
            <div className="p-4 bg-primary/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">{title}</h2>
            {description && (
              <p className="text-muted-foreground mb-6">
                {description}
              </p>
            )}
            {onAction && actionLabel && (
              <Button onClick={onAction} className="mt-4">
                {actionLabel}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
