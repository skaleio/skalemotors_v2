export type ZernioPlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "twitter"
  | "youtube";

export interface ZernioPlatformOption {
  id: ZernioPlatformId;
  label: string;
}

export const ZERNIO_PLATFORMS: ZernioPlatformOption[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
];
