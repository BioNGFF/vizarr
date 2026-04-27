import * as z from "zod";
import * as schemas from "zod-ome-ngff";


export function multiscaleTransformer(schema: z.infer<typeof schemas.v04.ImageSchema>): Ome.Multiscale[] {
  return schema.multiscales.map((multiscale) => {
    return ({
      datasets: multiscale.datasets,
      version: multiscale.version,
      coordinateTransformations: multiscale.coordinateTransformations,
      coordinateSystems: [{ "name": "default", "axes": multiscale.axes }]
    })
  })
}
