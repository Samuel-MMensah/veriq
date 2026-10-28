"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// The error state (Prompt 10c): one line and a retry. Nothing about the error itself is shown.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <h1 className="sr-only">Something went wrong</h1>
      <EmptyState
        icon="alert"
        title="Something went wrong"
        action={
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
