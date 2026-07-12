import { Construction } from "lucide-react";
import { PortalShell } from "@/components/layout/portal-shell";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return <PortalShell><section className="coming-soon"><div><Construction /><span className="eyebrow">Phase 1</span><h1>{title}</h1><p>{description}</p></div></section></PortalShell>;
}
