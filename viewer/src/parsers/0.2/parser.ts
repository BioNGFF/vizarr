import * as schema from 'zod-ome-ngff/0.2';
import { Parser } from "../parser"

export class V02Parser extends Parser {

  data: {}
  version = 'v02'
  schemas = {
    "WellSchema": schema.WellSchema,
    "PlateSchema": schema.PlateSchema,
    "ImageSchema": schema.ImageSchema,
  }

  constructor(data: {}) {
    super(data)
    this.data = data
  }

}











