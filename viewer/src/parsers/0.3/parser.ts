import * as schema from 'zod-ome-ngff/0.3';
import { Parser } from "../parser"

export class V03Parser extends Parser {

  data: {}
  version = 'v03'
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











