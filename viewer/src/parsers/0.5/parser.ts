import * as schema from 'zod-ome-ngff/0.5';
import { Parser } from "../parser"

export class V05Parser extends Parser {

  data: {}
  version = 'v05'
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











