
import { parsers } from './index'
import { assert } from '../utils'

export function parse(data: {}) {
  const schemaVersion = getSchemaVersion(data)
  const parser = new parsers[schemaVersion.version](data)
  const parsedData = parser.parse(schemaVersion.type)
  return {
    data: parsedData,
    version: schemaVersion
  }
}


function getSchemaVersion(data: {}): { type: string, version: string } {
  const versions = Object.keys(parsers)

  const schemasToCheck = versions.flatMap((version) => {

    const parser = new parsers[version](data)
    const parsedData = parser.getImageType(data)
    return parsedData.success ? { 'type': parsedData.schemaInfo.type, 'version': parsedData.schemaInfo.version } : null

  })

  const schemaInfo = schemasToCheck.filter((schema) => schema != null)
  //Return latest successfully parsed version if multiple are valid.
  //In theory only possible if the version number is missing and data happens to match multiple schema version
  return schemaInfo[schemaInfo.length - 1]

}








