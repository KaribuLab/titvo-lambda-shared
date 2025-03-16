export function parseDynamoDBResponse (response: any): any {
  if (response === undefined || response === null || response === '') return null

  // Procesar elementos individuales o listas completas
  if (Array.isArray(response)) {
    return response.map(item => parseDynamoDBAttribute(item))
  }

  if (typeof response === 'object') {
    const parsedObject: any = {}
    for (const key in response) {
      parsedObject[key] = parseDynamoDBAttribute(response[key])
    }
    return parsedObject
  }

  // Si el formato no es reconocible, retornar el valor sin cambios
  return response
}

export function parseDynamoDBAttribute (attribute: any): any {
  if (attribute === undefined || attribute === null) return null

  // Detectar y procesar según el tipo del atributo DynamoDB
  if ('S' in attribute) return attribute.S // String
  if ('N' in attribute) return Number(attribute.N) // Number
  if ('BOOL' in attribute) return attribute.BOOL // Boolean
  if ('NULL' in attribute) return null // Null
  if ('L' in attribute) {
    // Lista
    return attribute.L.map((item: any) => parseDynamoDBAttribute(item))
  }
  if ('M' in attribute) {
    // Mapa
    const parsedMap: any = {}
    for (const key in attribute.M) {
      parsedMap[key] = parseDynamoDBAttribute(attribute.M[key])
    }
    return parsedMap
  }

  // Si el formato no coincide con ninguno conocido, retornar el atributo sin cambios
  return attribute
}
