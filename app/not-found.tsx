import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// The "not found" state (Prompt 10c): one line and one way back.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState icon="search" title="We couldn't find that page" action={<Button href="/find">Find care</Button>} />
    </main>
  );
}
