import { KeyType } from 'aws-sdk/clients/dynamodb'
import { Util } from '../mapper/util'
import { ModelConstructor } from '../model/model-constructor'
import { TypeInfo } from './property-metadata.model'
import { initOrUpdateIndex, initOrUpdateProperty } from './property.decorator'
import { IndexType } from './index-type.enum'

export function GSISortKey(indexName: string): PropertyDecorator {
  return (target: any, propertyKey: string) => {
    initOrUpdateIndex(IndexType.GSI, { name: indexName, keyType: 'RANGE' }, target, propertyKey)
  }
}
