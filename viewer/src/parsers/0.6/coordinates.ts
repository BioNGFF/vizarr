import * as z from "zod";

const AxesSchema = z.object({
  name: z.string(),
  type: z.string()
})

const TransformationSchema = z.union([
  z.object({
    type: z.enum(["sequence"]),
    transformations: z.any(),

  }),
  z.object({ type: z.enum(["identity"]) }),
  z.object({
    type: z.enum(["scale"]),
    scale: z.array(z.number()),
  }),
  z.object({
    type: z.enum(["translation"]),
    translation: z.array(z.number()),
  }),

  z.object({
    type: z.enum(["rotation"]),
    rotation: z.array(z.number())
  }),
  z.object({
    type: z.enum(["affine"]),
    affine: z.array(z.array(z.number()))
  })

]);

const CoordinateTransformationSchema = z.object({
  input: z.object({ path: z.string(), name: z.string() }),
  output: z.object({ name: z.string() }),
  type: z.string(),
  transformations: z.array(TransformationSchema)
})


const CoordinateSystemSchema = z.object({
  name: z.string(),
  axes: z.array(AxesSchema)
})

const Scene = z.object({
  coordinateTransformations: z.array(CoordinateTransformationSchema),
  coordinateSystems: z.array(CoordinateSystemSchema).optional()
})

export const SceneSchema = z.object({
  ome: z.object({
    scene: Scene
  })
})

