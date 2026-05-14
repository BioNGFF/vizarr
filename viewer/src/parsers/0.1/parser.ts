import * as schema from 'zod-ome-ngff/0.1';
import { Parser } from "../parser"

export class V01Parser extends Parser {

  data: {}
  version = 'v01'
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











