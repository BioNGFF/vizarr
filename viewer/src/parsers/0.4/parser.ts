import * as schema from 'zod-ome-ngff/0.4';
import { Parser } from "../parser"

export class V04Parser extends Parser {

  data: {}
  version = 'v04'
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











