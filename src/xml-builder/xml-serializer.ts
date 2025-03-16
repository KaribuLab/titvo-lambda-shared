import { XMLBuilder, XmlBuilderOptions, XMLParser } from 'fast-xml-parser'
import { plainToInstance } from 'class-transformer'
import { getXmlMetadata } from './xml-serializer.decorator'
import { StructureXMLSerializerDto } from './structure-xml-serializer.dto'
import 'reflect-metadata'

interface namespaceOption { namespace: string, key: string, url: string }

interface JsonToXmlOptions {
  wrapperElement: string
  namespaceSoap: string
  headerElement: string
  bodyElement: string
}

interface JsonToXmlOptionsInput {
  wrapperElement?: string
  namespaceSoap?: string
  headerElement?: string
  bodyElement?: string
  namespaces?: namespaceOption[]
}

const enum DefaultKeys {
  namespaceSoap = 'soapenv',
  namespaceSoapUrl = 'http://schemas.xmlsoap.org/soap/envelope/',
  bodyElement = 'Body',
  headerElement = 'Header',
  wrapperElement = 'Envelope',
  attributeNamePrefix = '@_',
  namespaceAttribute = 'xmlns'
}

const DefaultNamespace: Record<string, string> = {
  [`${DefaultKeys.attributeNamePrefix}${DefaultKeys.namespaceAttribute}:${DefaultKeys.namespaceSoap}`]: DefaultKeys.namespaceSoapUrl
}

export class XMLSerializer {
  xmlBuilder: XMLBuilder
  xmlParser: XMLParser
  options: JsonToXmlOptions

  constructor () {
    this.options = {
      wrapperElement: DefaultKeys.wrapperElement,
      namespaceSoap: DefaultKeys.namespaceSoap,
      headerElement: DefaultKeys.headerElement,
      bodyElement: DefaultKeys.bodyElement
    }
    const xmlBuilderOptions: XmlBuilderOptions = {
      ignoreAttributes: false,
      format: true,
      attributeNamePrefix: DefaultKeys.attributeNamePrefix,
      suppressEmptyNode: true
    }
    const xmlParseOptions: XmlBuilderOptions = {
      ignoreAttributes: true,
      suppressEmptyNode: true
    }
    this.xmlBuilder = new XMLBuilder(xmlBuilderOptions)
    this.xmlParser = new XMLParser(xmlParseOptions)
  }

  build<T> (envelopeDto: T, options?: JsonToXmlOptionsInput): string {
    Object.assign(this.options, options ?? {})

    // elementWrapper
    const wrapperElementKey = this.getWrapperElementKey()

    // namespaces
    const namespaces = this.getNamespaces(options?.namespaces)

    const structureXMLDto = new StructureXMLSerializerDto<T>(envelopeDto)
    const jsonObj = this.createJsonObject(structureXMLDto)
    Object.assign(jsonObj[`${wrapperElementKey}`], namespaces)

    const xmlObject = this.jsonObjectToXml(jsonObj)
    return xmlObject
  }

  parse<T> (xmlResponse: string, targetKey: string, classDto?: new (...args: any[]) => T): T | null {
    const jsonResponse = this.xmlParser.parse(xmlResponse)
    const targetNode = this.findNode(jsonResponse, targetKey)
    if (targetNode === null) {
      return null
    }
    if (classDto === undefined) {
      return targetNode
    }

    return plainToInstance(classDto, targetNode, { excludeExtraneousValues: true })
  }

  private findNode (jsonResponse: any, targetKey: string): any | null {
    const hasOwnProperty = Object.prototype.hasOwnProperty
    if (typeof jsonResponse !== 'object' || jsonResponse === null) return null

    if (hasOwnProperty.call(jsonResponse, targetKey)) {
      return jsonResponse[targetKey]
    }
    for (const key in jsonResponse) {
      if (hasOwnProperty.call(jsonResponse, key)) {
        const result = this.findNode(jsonResponse[key], targetKey)
        if (result != null) return result
      }
    }
    return null
  }

  private getWrapperElementKey (): string {
    const wrapperElementKey: string = `${this.options.namespaceSoap}:${this.options.wrapperElement}`
    return wrapperElementKey
  }

  private getNamespaces (namespaceOptions?: namespaceOption[]): Record<string, string> {
    const namespaces: Record<string, string> = {}

    if (this.options.namespaceSoap === DefaultKeys.namespaceSoap) {
      Object.assign(namespaces, DefaultNamespace)
    }
    if (namespaceOptions === undefined) {
      return namespaces
    }

    for (const namespace of namespaceOptions) {
      const namespaceAttribute = namespace.namespace ?? DefaultKeys.namespaceAttribute
      namespaces[`${DefaultKeys.attributeNamePrefix}${namespaceAttribute}:${namespace.key}`] = namespace.url
    }

    return namespaces
  }

  private getXmlKey (key: string, fieldMetadata: any): string {
    let defaultKey
    if (fieldMetadata?.isBody === true) {
      defaultKey = this.options.bodyElement
    } else if (fieldMetadata?.isHeader === true) {
      defaultKey = this.options.headerElement
    }

    if (fieldMetadata?.isWrapper === true) {
      fieldMetadata.namespace = fieldMetadata.namespace ?? this.options.namespaceSoap
    }

    const elmentKey: string = fieldMetadata?.customName ?? defaultKey ?? key

    const xmlKey = (fieldMetadata?.namespace != null && fieldMetadata.namespace !== '')
      ? `${String(fieldMetadata.namespace)}:${elmentKey}`
      : elmentKey

    return xmlKey
  }

  private createJsonObject (dto: any): any {
    const metadata: Record<string, any> = getXmlMetadata(dto)
    const jsonObj: any = {}

    for (const [key, value] of Object.entries(dto)) {
      const fieldMetadata = metadata[key]
      const xmlKey = this.getXmlKey(key, fieldMetadata)

      if (fieldMetadata?.isAttribute === true) {
        jsonObj[`${DefaultKeys.attributeNamePrefix}${xmlKey}`] = value
      } else if (fieldMetadata?.isElement === true) {
        if (typeof value === 'object' && value !== null) {
          jsonObj[xmlKey] = this.createJsonObject(value)
        } else {
          jsonObj[xmlKey] = value
        }
      }
    }

    return jsonObj
  }

  private jsonObjectToXml (jsonObj: any): string {
    return this.xmlBuilder.build(jsonObj)
  }
}
