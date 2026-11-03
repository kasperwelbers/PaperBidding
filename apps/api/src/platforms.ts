import { presets as scholaronePresets } from "@cp/adapter-scholarone";

/** Supported platforms and their presets. Settings are copied from the preset
 *  into a new conference */
export const platforms = {
  scholarone: {
    name: "ScholarOne Abstracts",
    presets: scholaronePresets,
  },
} as const;

export type PlatformId = keyof typeof platforms;
export const platformIds = Object.keys(platforms) as [PlatformId, ...PlatformId[]];
