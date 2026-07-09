import { createFileRoute } from "@tanstack/react-router";
import SuperadminPanel from "@/components/SuperadminPanel";
import { Toaster } from "@/components/ui/sonner";

function SuperadminRoute() {
  return (
    <>
      <SuperadminPanel />
      <Toaster richColors position="top-right" />
    </>
  );
}

export const Route = createFileRoute("/superadmin")({
  component: SuperadminRoute,
});
