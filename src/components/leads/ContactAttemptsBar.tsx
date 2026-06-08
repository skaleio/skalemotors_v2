import { LeadMetricBar, type LeadMetricBarProps } from "@/components/leads/LeadMetricBar";

export type ContactAttemptsBarProps = Omit<LeadMetricBarProps, "field">;

export function ContactAttemptsBar(props: ContactAttemptsBarProps) {
  return <LeadMetricBar {...props} field="contact_attempts" />;
}
