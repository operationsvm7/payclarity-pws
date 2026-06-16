import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import CommissionTool from "@/components/CommissionTool";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <CommissionTool />
      <Toaster richColors position="top-right" />
    </>
  );
}
