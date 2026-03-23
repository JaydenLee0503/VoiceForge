import { clearSessionCameraRecordings } from "@/features/session/session-camera-storage";
import { clearSessionHistoryState } from "@/features/session/session-storage";
import { deleteSessionHistoryFromSupabase } from "@/lib/supabase/session-store";

let workspaceExitNavigationAllowed = false;
let pendingSessionDiscardHandler: null | (() => Promise<void> | void) = null;

export function registerPendingSessionDiscardHandler(
  handler: null | (() => Promise<void> | void),
) {
  pendingSessionDiscardHandler = handler;

  return () => {
    if (pendingSessionDiscardHandler === handler) {
      pendingSessionDiscardHandler = null;
    }
  };
}

export function isWorkspaceExitNavigationAllowed() {
  return workspaceExitNavigationAllowed;
}

export function beginWorkspaceExitNavigation() {
  workspaceExitNavigationAllowed = true;
}

export function endWorkspaceExitNavigation() {
  workspaceExitNavigationAllowed = false;
}

export async function runPendingSessionDiscardHandler() {
  await pendingSessionDiscardHandler?.();
}

export async function clearWorkspaceHistoryLocally() {
  clearSessionHistoryState();

  try {
    await clearSessionCameraRecordings();
  } catch (error) {
    console.warn("[voiceforge] Local camera history clear failed:", error);
  }
}

export async function deleteWorkspaceHistory() {
  await deleteSessionHistoryFromSupabase();
  await clearWorkspaceHistoryLocally();
}
