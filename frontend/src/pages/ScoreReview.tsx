import { useNavigate } from "react-router-dom";
import Layout, { Icon } from "../components/Layout";

// Per-answer score review requires attempt-detail endpoints that aren't built
// yet, so this is a clean placeholder rather than sample data.
export default function ScoreReview() {
  const nav = useNavigate();
  return (
    <Layout title="Score Review">
      <button onClick={() => nav("/analytics")}
        className="flex items-center gap-1 text-secondary text-sm font-semibold mb-4 hover:underline">
        <Icon name="arrow_back" className="text-[18px]" /> Back to Analytics
      </button>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-4">
          <Icon name="fact_check" className="text-3xl" />
        </div>
        <h3 className="font-headline text-lg text-primary mb-1">Score review coming soon</h3>
        <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
          Per-student answer review and manual grade adjustment will appear here once attempt-detail data is available.
        </p>
      </div>
    </Layout>
  );
}
