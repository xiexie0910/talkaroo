/** Live voice connection state shown in the session UI. */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error";
