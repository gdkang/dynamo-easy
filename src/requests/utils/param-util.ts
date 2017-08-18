import { Condition } from './condition.model'
import { QueryInput, ScanInput } from 'aws-sdk/clients/dynamodb'
import { isEmpty, isString } from 'lodash'

export class ParamUtil {
  static addFilterCondition<T>(condition: Condition, params: QueryInput | ScanInput) {
    const expressionAttributeNames = Object.assign({}, condition.attributeNames, params.ExpressionAttributeNames)
    const expressionAttributeValues = Object.assign({}, condition.attributeMap, params.ExpressionAttributeValues)

    if (!isEmpty(expressionAttributeNames)) {
      params.ExpressionAttributeNames = expressionAttributeNames
    }

    if (!isEmpty(expressionAttributeValues)) {
      params.ExpressionAttributeValues = expressionAttributeValues
    }

    if (isString(params.FilterExpression)) {
      params.FilterExpression = params.FilterExpression + ' AND (' + condition.statement + ')'
    } else {
      params.FilterExpression = '(' + condition.statement + ')'
    }
  }

  static addKeyCondition<T>(condition: Condition, params: QueryInput) {
    const expressionAttributeNames = Object.assign({}, condition.attributeNames, params.ExpressionAttributeNames)
    const expressionAttributeValues = Object.assign({}, condition.attributeMap, params.ExpressionAttributeValues)

    if (!isEmpty(expressionAttributeNames)) {
      params.ExpressionAttributeNames = expressionAttributeNames
    }

    if (!isEmpty(expressionAttributeValues)) {
      params.ExpressionAttributeValues = expressionAttributeValues
    }

    if (isString(params.KeyConditionExpression)) {
      params.KeyConditionExpression = params.KeyConditionExpression + ' AND (' + condition.statement + ')'
    } else {
      params.KeyConditionExpression = '(' + condition.statement + ')'
    }
  }
}
