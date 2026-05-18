import { Button } from "@/components/ui/button";
import {
  CRM_PIPELINE_STATUS_LABELS,
  CRM_STAGE_DOT_CLASS,
  CRM_STAGE_PILL_CLASS,
  type CrmStageKey,
} from "@/lib/crmPipeline";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";

const BANNER_TRANSITION = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1] as const,
};

export type CrmPipelineMoveNotice = {
  id: string;
  leadName: string;
  fromStage: CrmStageKey;
  toStage: CrmStageKey;
};

type CrmPipelineMoveBannerProps = {
  notice: CrmPipelineMoveNotice | null;
  onDismiss: () => void;
};

function StagePill({ stageKey }: { stageKey: CrmStageKey }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        CRM_STAGE_PILL_CLASS[stageKey],
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CRM_STAGE_DOT_CLASS[stageKey])} aria-hidden />
      {CRM_PIPELINE_STATUS_LABELS[stageKey]}
    </span>
  );
}

export function CrmPipelineMoveBanner({ notice, onDismiss }: CrmPipelineMoveBannerProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {notice ? (
        <motion.div
          key={notice.id}
          role="status"
          aria-live="polite"
          layout
          initial={{ opacity: 0, y: -14, scale: 0.97, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, scale: 0.98, filter: "blur(12px)" }}
          transition={BANNER_TRANSITION}
          className="mb-4 overflow-hidden"
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border border-border/60",
              "bg-card/95 shadow-lg shadow-black/5 backdrop-blur-md",
            )}
          >
            <motion.div
              className={cn("pointer-events-none absolute inset-y-0 left-0 w-1", CRM_STAGE_DOT_CLASS[notice.toStage])}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...BANNER_TRANSITION, delay: 0.06 }}
              style={{ transformOrigin: "top" }}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 pl-5 sm:flex-nowrap">
              <motion.div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                )}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...BANNER_TRANSITION, delay: 0.08 }}
                aria-hidden
              >
                <Check className="h-5 w-5 stroke-[2.5]" />
              </motion.div>

              <motion.div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Lead movido en el pipeline</p>
                <motion.div
                  className="flex flex-wrap items-center gap-2 text-sm"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...BANNER_TRANSITION, delay: 0.1 }}
                >
                  <span className="max-w-[14rem] truncate font-semibold text-foreground" title={notice.leadName}>
                    {notice.leadName}
                  </span>
                  <StagePill stageKey={notice.fromStage} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <StagePill stageKey={notice.toStage} />
                </motion.div>
              </motion.div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onDismiss}
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

