import { Expose } from 'class-transformer'
import 'reflect-metadata'

const xmlMetadata = new Map<any, Record<string, any>>()

function XmlNamespace (prefix: string) {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], namespace: prefix }
    xmlMetadata.set(target.constructor, meta)
  }
}

function XmlElement (name?: string) {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], isElement: true, customName: name }
    xmlMetadata.set(target.constructor, meta)

    const customName = name !== undefined ? name : propertyKey
    Expose({ name: customName })(target, propertyKey)
  }
}

function XmlHeader () {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], isHeader: true, isWrapper: true }
    xmlMetadata.set(target.constructor, meta)
  }
}

function XmlBody () {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], isBody: true, isWrapper: true }
    xmlMetadata.set(target.constructor, meta)
  }
}

function XmlAttribute (name?: string) {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], isAttribute: true, customName: name }
    xmlMetadata.set(target.constructor, meta)
  }
}

function XmlWrapper (name?: string) {
  return function (target: any, propertyKey: string) {
    const meta = xmlMetadata.get(target.constructor) ?? {}
    meta[propertyKey] = { ...meta[propertyKey], isWrapper: true }
    xmlMetadata.set(target.constructor, meta)
  }
}

function getXmlMetadata (target: any): object {
  return xmlMetadata.get(target.constructor) ?? {}
}

export { XmlNamespace, XmlElement, XmlHeader, XmlBody, XmlAttribute, getXmlMetadata, XmlWrapper }
