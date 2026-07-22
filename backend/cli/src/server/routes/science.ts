import { Hono } from "hono"
import { validator } from "hono-openapi"
import { ScienceProject } from "../../science/project"
import { lazy } from "../../util/lazy"

export const ScienceRoutes = lazy(() =>
  new Hono().post("/project", validator("json", ScienceProject.Input), async (c) => {
    const input = c.req.valid("json")
    const result = await ScienceProject.init(input)
    return c.json(result, 201)
  }),
)
