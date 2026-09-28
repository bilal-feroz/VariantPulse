"use client";

/**
 * Says why an action is not available to the signed-in role and, in this
 * demonstration, offers to switch to an identity that holds it. In a pilot the
 * switch would not exist: identities come from the facility's provider.
 */

import { ArrowLeftRight, Lock } from "lucide-react";

import { PERSONA_BY_ID } from "@/data/workspace";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

export function RoleNote({
  reason,
  switchTo,
  className,
}: {
  reason: string | null;
  /** A persona who could take the action, offered as a demonstration switch. */
  switchTo?: string;
  className?: string;
}) {
  const { persona, switchPersona } = useWorkspace();
  if (!reason) return null;
  const target = switchTo ? PERSONA_BY_ID.get(switchTo) : undefined;
  const offer = target && target.id !== persona.id ? target : undefined;

  return (
    <p className={cn("flex items-start gap-2 text-[11.5px] leading-relaxed text-muted", className)}>
      <Lock className="mt-[3px] h-3 w-3 shrink-0 text-faint" aria-hidden />
      <span>
        {reason}
        {offer ? (
          <>
            {" "}
            <button
              type="button"
              onClick={() => switchPersona(offer.id)}
              className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline"
            >
              <ArrowLeftRight className="h-3 w-3" aria-hidden />
              Sign in as {offer.name} ({ROLES[offer.role].label.toLowerCase()}, demo)
            </button>
          </>
        ) : null}
      </span>
    </p>
  );
}
