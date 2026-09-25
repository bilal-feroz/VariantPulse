import Link from "next/link";

import { PageShell } from "@/components/page-header";
import { Button, Card, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <Card className="mt-6">
        <EmptyState
          title="That record does not exist"
          description="The identifier may have been mistyped, or the record is not held in this workspace. Try the global search with Ctrl K."
          action={
            <Link href="/">
              <Button variant="primary">Back to the workspace</Button>
            </Link>
          }
        />
      </Card>
    </PageShell>
  );
}
