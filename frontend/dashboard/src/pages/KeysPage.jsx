import SectionHeader from "../components/layout/SectionHeader";
import KeyExplorer from "../components/governance/KeyExplorer";

export default function KeysPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Key Explorer"
        subtitle="Inspect generated keys, lifecycle state, and policy compliance."
      />

      <KeyExplorer />
    </div>
  );
}