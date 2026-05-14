import * as schema from 'zod-ome-ngff/0.6';
import { SceneSchema } from "./coordinates"
import { Parser } from "../parser"

export class V06Parser extends Parser {

  data: {}
  version = 'v06'
  schemas = {
    "WellSchema": schema.WellSchema,
    "PlateSchema": schema.PlateSchema,
    "ImageSchema": schema.ImageSchema,
    "SceneSchema": SceneSchema
  }

  constructor(data: {}) {
    super(data)
    this.data = data
  }

}











