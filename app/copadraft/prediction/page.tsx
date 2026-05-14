import PredictionPageClient from "./PredictionPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PredictionPage() {
  return <PredictionPageClient />;
}
