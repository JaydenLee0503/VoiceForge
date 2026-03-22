import { useCallback, useEffect, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

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

  const allowNextNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);

  const blocker = useBlocker(
    useCallback(() => enabled && !allowNavigationRef.current, [enabled]),
  );

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!enabled || allowNavigationRef.current) {
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
