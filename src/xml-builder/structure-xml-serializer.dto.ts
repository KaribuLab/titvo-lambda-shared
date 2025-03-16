import { XmlElement, XmlWrapper } from './xml-serializer.decorator'

export class StructureXMLSerializerDto<T> {
  @XmlWrapper()
  @XmlElement('Envelope')
    envelope: T

  constructor (envelope: T) {
    this.envelope = envelope
  }
}
