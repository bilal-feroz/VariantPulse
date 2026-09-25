"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Button, Card, EmptyState } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-5 pb-12 sm:px-6 lg:px-8">
      <Card className="mt-6">
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5" />}
          title="Something went wrong loading this view"
          description="No records were changed. Retry, and if it persists the evidence source may be unreachable — the workspace will fall back to its cached snapshot."
          action={
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
