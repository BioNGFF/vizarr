import * as z from "zod";

const AxesSchema = z.object({
  name: z.string(),
  type: z.string()
})

const TransformationSchema = z.object({
  name: z.string(),
  type: z.string()
})

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

