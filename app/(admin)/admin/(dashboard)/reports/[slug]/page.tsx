import { notFound } from "next/navigation";
import { GenericReport } from "./generic-report";

const KNOWN_SLUGS = new Set([
  "revenue-monthly",
  "installment-collection",
  "default-rate",
  "gateway-uptime",
  "meter-accuracy",
  "neighbor-churn",
  "host-earnings",
  "platform-fee-trend",
]);

export default function ReportBySlug({ params }: { params: { slug: string } }) {
  if (!KNOWN_SLUGS.has(params.slug)) notFound();
  return <GenericReport slug={params.slug} />;
}
