import { useCallback, useEffect, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import {
  isWorkspaceExitNavigationAllowed,
  registerPendingSessionDiscardHandler,
} from "@/lib/workspace/exit-workspace";

type UseSessionExitGuardOptions = {
  enabled: boolean;
  message: string;
  onDiscard?: () => Promise<void> | void;
};

type UseSessionExitGuardResult = {
  allowNextNavigation: () => void;
};

export function useSessionExitGuard({
  enabled,
  message,
  onDiscard,
}: UseSessionExitGuardOptions): UseSessionExitGuardResult {
  const allowNavigationRef = useRef(false);
  const discardRef = useRef(onDiscard);
  const handlingBlockRef = useRef(false);

  useEffect(() => {
    discardRef.current = onDiscard;
  }, [onDiscard]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return registerPendingSessionDiscardHandler(async () => {
      await discardRef.current?.();
    });
  }, [enabled]);

  const allowNextNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);

  const blocker = useBlocker(
    useCallback(
      () =>
        enabled &&
        !allowNavigationRef.current &&
        !isWorkspaceExitNavigationAllowed(),
      [enabled],
    ),
  );

  useBeforeUnload(
    useCallback(
      (event) => {
        if (
          !enabled ||
          allowNavigationRef.current ||
          isWorkspaceExitNavigationAllowed()
        ) {
          return;
        }

        event.preventDefault();
        event.returnValue = "";
      },
      [enabled],
    ),
  );

  useEffect(() => {
    if (blocker.state !== "blocked" || handlingBlockRef.current) {
      return;
    }

    handlingBlockRef.current = true;

    void (async () => {
      const shouldDiscard = window.confirm(message);

      if (!shouldDiscard) {
        blocker.reset();
        handlingBlockRef.current = false;
        return;
      }

      allowNavigationRef.current = true;

      try {
        await discardRef.current?.();
      } catch (error) {
        console.warn("[voiceforge] Session discard cleanup failed:", error);
      }

      blocker.proceed();
      handlingBlockRef.current = false;
    })();
  }, [blocker, message]);

  return { allowNextNavigation };
}
