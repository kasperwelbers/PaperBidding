import { router } from "../context";
import { requireUser } from "../middleware";
import { platforms } from "../platforms";

export const platformRoutes = router()
  .use(requireUser)
  .get("/", (c) =>
    c.json(
      Object.entries(platforms).map(([id, p]) => ({
        id,
        name: p.name,
        presets: p.presets.map((preset) => ({ id: preset.id, name: preset.name })),
      })),
    ),
  );
