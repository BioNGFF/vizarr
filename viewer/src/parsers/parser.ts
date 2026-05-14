import { z } from 'zod';


type ImageType = "WellSchema" | "PlateSchema" | "ImageSchema" | "SceneSchema"
type ImageVersion = "v01" | "v02" | "v03" | "v04" | "v05" | "v06"

type SchemaInfo = { type: ImageType, version: ImageVersion }

type Schemas = Record<ImageType, z.Schema>

export class Parser {

  data: {}
  schemas: Schemas = {}
  version: ImageVersion = 'v01'
  constructor(data: {}) {
    this.data = data
  }
  parse(imageType: ImageType) {
    return this.schemas[imageType].parse(this.data)
  }

  getImageType() {
    const checkedSchemas = Object.keys(this.schemas).map((imageType) => {
      return this.schemas[imageType].safeParse(this.data).success ? { 'type': imageType, version: this.version } : null
    })
    const schemaInfo = checkedSchemas.filter((schema) => schema != null)[0]
    return schemaInfo ? { schemaInfo: schemaInfo, success: true } : { success: false }
  }

  transformAxesToCoordinateSystems(axes: Ome.Axis[]): Ome.CoordinateSystem[] {
    return [
      {
        name: 'default',
        axes: axes
      }
    ]
  }

}

