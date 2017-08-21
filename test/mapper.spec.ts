import {
  AttributeValue,
  AttributeValueList,
  ListAttributeValue,
  MapAttributeValue,
  StringSetAttributeValue,
} from 'aws-sdk/clients/dynamodb'
import moment from 'moment'
import 'moment/locale/de-ch'
import { AttributeMap } from '../attribute-map.type'
import { Moment } from '../src/decorator/moment.type'
import { PropertyMetadata } from '../src/decorator/property-metadata.model'
import { Mapper } from '../src/mapper/mapper'
import {
  organization1CreatedAt,
  organization1Employee1CreatedAt,
  organization1Employee2CreatedAt,
  organization1LastUpdated,
  organizationFromDb,
} from './data/organization-dynamodb.data'
import { productFromDb } from './data/product-dynamodb.data'
import { Employee } from './models/employee.model'
import { ModelWithAutogeneratedId } from './models/model-with-autogenerated-id.model'
import { Id, ModelWithCustomMapperModel } from './models/model-with-custom-mapper.model'
import { Birthday, Organization, OrganizationEvent } from './models/organization.model'
import { Product } from './models/product.model'

describe('Mapper', () => {
  describe('should map single values', () => {
    describe('to db', () => {
      it('string', () => {
        const attrValue: AttributeValue = Mapper.toDbOne('foo')
        expect(attrValue).toBeDefined()
        expect(attrValue.S).toBeDefined()
        expect(attrValue.S).toBe('foo')
      })

      it('number', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(3)
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('N')
        expect(attrValue.N).toBe('3')
      })

      it('boolean', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(false)
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('BOOL')
        expect(attrValue.BOOL).toBe(false)
      })

      it('null', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(null)
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('NULL')
        expect(attrValue.NULL).toBe(true)
      })

      it('date (moment)', () => {
        const m = moment()
        const attrValue: AttributeValue = Mapper.toDbOne(m)
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('S')
        expect(attrValue.S).toBe(m.clone().utc().format())
      })

      it('array -> SS (homogen, no duplicates)', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(['foo', 'bar'])
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('SS')
        expect(attrValue.SS[0]).toBe('foo')
        expect(attrValue.SS[1]).toBe('bar')
      })

      it('array -> L (homogen, no duplicates, explicit type)', () => {
        const propertyMetadata = <Partial<PropertyMetadata<any>>>{
          typeInfo: { type: Array, typeName: 'Array', isCustom: true },
        }
        const attrValue: AttributeValue = Mapper.toDbOne(['foo', 'bar'], <any>propertyMetadata)
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('L')

        expect(keyOf(attrValue.L[0])).toBe('S')
        expect(attrValue.L[0].S).toBe('foo')

        expect(keyOf(attrValue.L[1])).toBe('S')
        expect(attrValue.L[1].S).toBe('bar')
      })

      // TODO should we handle arrays with duplicates as list, or throw an error
      // it('array (homogen, duplicates)', () => {
      //   let attrValue: AttributeValue = Mapper.mapToDbOne(['foo', 'bar', 'foo']);
      //   expect(attrValue).toBeDefined();
      //   expect(keyOf(attrValue)).toBe('L');
      //   expect(attrValue.L).toBeDefined();
      //   expect(attrValue.L.length).toBe(3);
      //   const foo: AttributeValue = attrValue.L[0];
      //   expect(foo).toBeDefined();
      //   expect(keyOf(foo)).toBe('S');
      //   expect(foo.S).toBe('foo');
      // });

      it('array -> L (heterogen, no duplicates)', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(['foo', 56, true])
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('L')
        expect(attrValue.L).toBeDefined()
        expect(attrValue.L.length).toBe(3)

        const foo: AttributeValue = attrValue.L[0]
        expect(foo).toBeDefined()
        expect(keyOf(foo)).toBe('S')
        expect(foo.S).toBe('foo')

        const no: AttributeValue = attrValue.L[1]
        expect(no).toBeDefined()
        expect(keyOf(no)).toBe('N')
        expect(no.N).toBe('56')

        const bool: AttributeValue = attrValue.L[2]
        expect(bool).toBeDefined()
        expect(keyOf(bool)).toBe('BOOL')
        expect(bool.BOOL).toBe(true)
      })

      it('array -> L (homogen, complex type)', () => {
        const attrValue: AttributeValue = Mapper.toDbOne([
          new Employee('max', 25, moment(), null),
          new Employee('anna', 65, moment(), null),
        ])

        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('L')

        const employee1 = attrValue.L[0]
        expect(employee1).toBeDefined()
        expect(keyOf(employee1)).toBe('M')
        expect(Object.keys(employee1.M).length).toBe(3)
        expect(employee1.M['name']).toBeDefined()
        expect(keyOf(employee1.M['name'])).toBe('S')
        expect(employee1.M['name']['S']).toBe('max')

        expect(employee1.M['age']).toBeDefined()
        expect(keyOf(employee1.M['age'])).toBe('N')
        expect(employee1.M['age']['N']).toBe('25')
        // TODO test for moment date
      })

      it('set', () => {
        const attrValue: AttributeValue = Mapper.toDbOne(new Set(['foo', 'bar', 25]))
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('SS')
        expect(attrValue.SS[0]).toBe('foo')
        expect(attrValue.SS[1]).toBe('bar')
      })

      it('set of employees', () => {
        const cd: moment.Moment = moment('2017-02-03', 'YYYY-MM-DD')
        const cd2: moment.Moment = moment('2017-02-28', 'YYYY-MM-DD')
        const attrValue: AttributeValue = Mapper.toDbOne(
          new Set([
            <Employee>{ name: 'foo', age: 56, createdAt: cd },
            <Employee>{ name: 'anna', age: 26, createdAt: cd2 },
          ])
        )

        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('L')
        expect(attrValue.L.length).toBe(2)
        expect(attrValue.L[0].M).toBeDefined()
        expect(attrValue.L[0].M['name']).toBeDefined()
        expect(keyOf(attrValue.L[0].M['name'])).toBe('S')
        expect(attrValue.L[0].M['name'].S).toBe('foo')
      })

      it('object (Employee created using Object literal)', () => {
        const cr: moment.Moment = moment('2017-03-03', 'YYYY-MM-DD')
        const attrValue: AttributeValue = Mapper.toDbOne(<Employee>{ name: 'foo', age: 56, createdAt: cr })
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('M')

        // name
        expect(attrValue.M['name']).toBeDefined()
        expect(keyOf(attrValue.M['name'])).toBe('S')
        expect(attrValue.M['name'].S).toBe('foo')

        // age
        expect(attrValue.M['age']).toBeDefined()
        expect(keyOf(attrValue.M['age'])).toBe('N')
        expect(attrValue.M['age'].N).toBe('56')

        // createdAt
        expect(attrValue.M['createdAt']).toBeDefined()
        expect(keyOf(attrValue.M['createdAt'])).toBe('S')
        expect(attrValue.M['createdAt'].S).toBe(cr.clone().utc().format())
      })

      it('object (Employee created using constructor)', () => {
        const cr: moment.Moment = moment('2017-05-03', 'YYYY-MM-DD')
        const attrValue: AttributeValue = Mapper.toDbOne(new Employee('foo', 56, cr, []))
        expect(attrValue).toBeDefined()
        expect(keyOf(attrValue)).toBe('M')

        // name
        expect(attrValue.M['name']).toBeDefined()
        expect(keyOf(attrValue.M['name'])).toBe('S')
        expect(attrValue.M['name'].S).toBe('foo')

        // age
        expect(attrValue.M['age']).toBeDefined()
        expect(keyOf(attrValue.M['age'])).toBe('N')
        expect(attrValue.M['age'].N).toBe('56')

        // createdAt
        expect(attrValue.M['createdAt']).toBeDefined()
        expect(keyOf(attrValue.M['createdAt'])).toBe('S')
        expect(attrValue.M['createdAt'].S).toBe(cr.clone().utc().format())
      })
    })

    describe('from db', () => {
      let date: moment.Moment

      beforeEach(() => {
        date = moment('2017-12-24')
      })

      it('S -> String', () => {
        const attrValue = { S: 'foo' }
        expect(Mapper.fromDbOne(attrValue)).toBe('foo')
      })

      it('S -> Moment from convention', () => {
        const attrValue = { S: date.clone().utc().format() }
        const momentOb = Mapper.fromDbOne<moment.Moment>(attrValue)
        expect(moment.isMoment(momentOb)).toBeTruthy()
        expect(momentOb.isValid()).toBeTruthy()
        expect(momentOb.isSame(date)).toBeTruthy()
      })

      it('S -> Moment from type decoration', () => {
        const propertyMetadata = <Partial<PropertyMetadata<any>>>{
          typeInfo: { type: Moment, typeName: 'Moment', isCustom: true },
        }
        const attrValue = { S: date.clone().utc().format() }
        const momentOb = Mapper.fromDbOne<moment.Moment>(attrValue, <any>propertyMetadata)
        expect(moment.isMoment(momentOb)).toBeTruthy()
        expect(momentOb.isValid()).toBeTruthy()
        expect(momentOb.isSame(date)).toBeTruthy()
      })

      it('N -> Number', () => {
        const attrValue = { N: '56' }
        expect(Mapper.fromDbOne(attrValue)).toBe(56)
      })

      it('BOOL -> Boolean', () => {
        const attrValue = { BOOL: true }
        expect(Mapper.fromDbOne(attrValue)).toBe(true)
      })

      it('NULL -> null', () => {
        const attrValue = { NULL: true }
        expect(Mapper.fromDbOne(attrValue)).toBe(null)
      })

      it('SS -> set', () => {
        const attrValue = { SS: ['foo', 'bar'] }
        const set: Set<string> = Mapper.fromDbOne(attrValue)
        expect(set instanceof Set).toBeTruthy()
        expect(set.size).toBe(2)
        expect(Array.from(set)[0]).toBe('foo')
        expect(Array.from(set)[1]).toBe('bar')
      })

      it('SS -> array', () => {
        const propertyMetadata = <Partial<PropertyMetadata<any>>>{
          typeInfo: { type: Array, typeName: 'Array', isCustom: true },
        }
        const attrValue = { SS: ['foo', 'bar'] }
        const arr = Mapper.fromDbOne<string[]>(attrValue, <any>propertyMetadata)
        expect(Array.isArray(arr)).toBeTruthy()
        expect(arr.length).toBe(2)
        expect(arr[0]).toBe('foo')
        expect(arr[1]).toBe('bar')
      })

      it('NS -> set', () => {
        const attrValue = { NS: ['45', '2'] }
        const set = Mapper.fromDbOne<Set<number>>(attrValue)
        expect(set instanceof Set).toBeTruthy()
        expect(set.size).toBe(2)
        expect(Array.from(set)[0]).toBe(45)
        expect(Array.from(set)[1]).toBe(2)
      })

      // TODO implement test for binary
      // it('bs -> set', () => {
      // });

      it('NS -> array', () => {
        const propertyMetadata = <Partial<PropertyMetadata<any>>>{
          typeInfo: { type: Array, typeName: 'Array', isCustom: true },
        }
        const attrValue = { NS: ['45', '2'] }
        const arr = Mapper.fromDbOne<number[]>(attrValue, <any>propertyMetadata)
        expect(Array.isArray(arr)).toBeTruthy()
        expect(arr.length).toBe(2)
        expect(arr[0]).toBe(45)
        expect(arr[1]).toBe(2)
      })

      it('L -> array', () => {
        const attrValue = { L: [{ S: 'foo' }, { N: '45' }, { BOOL: true }] }
        const arr: any[] = Mapper.fromDbOne<any[]>(attrValue)
        expect(Array.isArray(arr)).toBeTruthy()
        expect(arr.length).toBe(3)
        expect(arr[0]).toBe('foo')
        expect(arr[1]).toBe(45)
        expect(arr[2]).toBe(true)
      })

      it('L -> set', () => {
        const propertyMetadata = <Partial<PropertyMetadata<any>>>{
          typeInfo: { type: Set, typeName: 'Set', isCustom: true },
        }
        const attrValue = { L: [{ S: 'foo' }, { N: '45' }, { BOOL: true }] }
        const set = Mapper.fromDbOne<Set<any>>(attrValue, <any>propertyMetadata)
        expect(set instanceof Set).toBeTruthy()
        expect(set.size).toBe(3)
        expect(Array.from(set)[0]).toBe('foo')
        expect(Array.from(set)[1]).toBe(45)
        expect(Array.from(set)[2]).toBe(true)
      })

      it('M', () => {
        const createdAt: moment.Moment = moment('2017-05-02', 'YYYY-MM-DD')
        const lastUpdatedDate: moment.Moment = moment('2017-07-05', 'YYYY-MM-DD')
        const attrValue = {
          M: {
            name: { S: 'name' },
            age: { N: '56' },
            active: { BOOL: true },
            siblings: { SS: ['hans', 'andi', 'dora'] },
            createdAt: {
              S: createdAt.clone().utc().format(moment.defaultFormat),
            },
            lastUpdatedDate: {
              S: createdAt.clone().utc().format(moment.defaultFormat),
            },
          },
        }
        const obj = Mapper.fromDbOne<any>(attrValue)

        expect(obj.name).toBe('name')
        expect(obj.age).toBe(56)
        expect(obj.active).toBe(true)
        expect(obj.siblings).toBeDefined()
        expect(obj.siblings instanceof Set).toBeTruthy()
        expect(obj.siblings.size).toBe(3)
        expect(Array.from(obj.siblings)[0]).toBe('hans')
        expect(Array.from(obj.siblings)[1]).toBe('andi')
        expect(Array.from(obj.siblings)[2]).toBe('dora')
      })
    })
  })

  describe('should map model', () => {
    describe('to db', () => {
      describe('model class created with new', () => {
        let organization: Organization
        let organizationAttrMap: AttributeMap<Organization>
        let createdAt: moment.Moment
        let lastUpdated: moment.Moment
        let createdAtDateEmployee1: moment.Moment
        let createdAtDateEmployee2: moment.Moment
        let birthday1Date: moment.Moment
        let birthday2Date: moment.Moment

        beforeEach(() => {
          organization = new Organization()
          organization.id = 'myId'
          organization.name = 'shiftcode GmbH'
          createdAt = moment()
          organization.createdAtDate = createdAt
          lastUpdated = moment('2017-03-21', 'YYYY-MM-DD')
          organization.lastUpdated = lastUpdated
          organization.active = true
          organization.count = 52

          organization.domains = ['shiftcode.ch', 'shiftcode.io', 'shiftcode.it']
          organization.randomDetails = ['sample', 26, true]

          const employees: Employee[] = []
          createdAtDateEmployee1 = moment('2017-03-05', 'YYYY-MM-DD')
          createdAtDateEmployee2 = moment()

          employees.push(new Employee('max', 50, createdAtDateEmployee1, []))
          employees.push(new Employee('anna', 27, createdAtDateEmployee2, []))
          organization.employees = employees

          organization.cities = new Set(['zürich', 'bern'])

          birthday1Date = moment('1975-03-05', 'YYYY-MM-DD')
          birthday2Date = moment('1987-07-07', 'YYYY-MM-DD')
          organization.birthdays = new Set([
            new Birthday(birthday1Date, 'ticket to rome', 'camper van'),
            new Birthday(birthday2Date, 'car', 'gin'),
          ])

          organization.awards = new Set(['good, better, shiftcode', 'jus kiddin'])

          const events = new Set()
          events.add(new OrganizationEvent('shift the web', 1520))
          organization.events = events

          // TODO add map data?
          // const benefits: Map<number, string> = new Map();
          // benefits.set(2012, 'wine');
          // benefits.set(2013, 'moooney');
          // organization.benefits = benefits;

          organization.transient = 'the value which is marked as transient'

          organizationAttrMap = Mapper.toDb(organization, Organization)
        })

        describe('creates correct attribute map', () => {
          it('all properties are mapped', () => {
            expect(Object.keys(organizationAttrMap).length).toBe(13)
          })

          it('id', () => {
            expect(organizationAttrMap.id).toEqual({ S: 'myId' })
          })

          it('createdAtDate', () => {
            expect(organizationAttrMap.createdAtDate).toBeDefined()
            expect(organizationAttrMap.createdAtDate.S).toBeDefined()
            expect(organizationAttrMap.createdAtDate.S).toBe(createdAt.clone().utc().format())
          })

          it('lastUpdated', () => {
            expect(organizationAttrMap.lastUpdated).toBeDefined()
            expect(organizationAttrMap.lastUpdated.S).toBeDefined()
            expect(organizationAttrMap.lastUpdated.S).toBe(lastUpdated.clone().utc().format())
          })

          it('active', () => {
            expect(organizationAttrMap.active).toBeDefined()
            expect(organizationAttrMap.active.BOOL).toBeDefined()
            expect(organizationAttrMap.active.BOOL).toBe(true)
          })

          it('count', () => {
            expect(organizationAttrMap.count).toEqual({ N: '52' })
          })

          it('domains', () => {
            expect(organizationAttrMap.domains).toBeDefined()

            const domains: StringSetAttributeValue = organizationAttrMap.domains.SS
            expect(domains).toBeDefined()
            expect(domains.length).toBe(3)

            expect(domains[0]).toBe('shiftcode.ch')
            expect(domains[1]).toBe('shiftcode.io')
            expect(domains[2]).toBe('shiftcode.it')
          })

          it('random details', () => {
            expect(organizationAttrMap.randomDetails).toBeDefined()

            const randomDetails: ListAttributeValue = organizationAttrMap.randomDetails.L
            expect(randomDetails).toBeDefined()
            expect(randomDetails.length).toBe(3)

            expect(keyOf(randomDetails[0])).toBe('S')
            expect(randomDetails[0].S).toBe('sample')

            expect(keyOf(randomDetails[1])).toBe('N')
            expect(randomDetails[1].N).toBe('26')

            expect(keyOf(randomDetails[2])).toBe('BOOL')
            expect(randomDetails[2].BOOL).toBe(true)
          })

          it('employees', () => {
            expect(organizationAttrMap.employees).toBeDefined()
            const employeesL: AttributeValueList = organizationAttrMap.employees.L
            expect(employeesL).toBeDefined()
            expect(employeesL.length).toBe(2)
            expect(employeesL[0]).toBeDefined()
            expect(employeesL[0].M).toBeDefined()

            // test employee1
            const employee1: MapAttributeValue = employeesL[0].M
            expect(employee1['name']).toBeDefined()
            expect(employee1['name'].S).toBeDefined()
            expect(employee1['name'].S).toBe('max')
            expect(employee1['age']).toBeDefined()
            expect(employee1['age'].N).toBeDefined()
            expect(employee1['age'].N).toBe('50')
            expect(employee1['createdAt']).toBeDefined()
            expect(employee1['createdAt'].S).toBeDefined()
            expect(employee1['createdAt'].S).toBe(createdAtDateEmployee1.clone().utc().format())

            // test employee2
            const employee2: MapAttributeValue = employeesL[1].M
            expect(employee2['name']).toBeDefined()
            expect(employee2['name'].S).toBeDefined()
            expect(employee2['name'].S).toBe('anna')
            expect(employee2['age']).toBeDefined()
            expect(employee2['age'].N).toBeDefined()
            expect(employee2['age'].N).toBe('27')
            expect(employee2['createdAt']).toBeDefined()
            expect(employee2['createdAt'].S).toBeDefined()
            expect(employee2['createdAt'].S).toBe(createdAtDateEmployee2.clone().utc().format())
          })

          it('cities', () => {
            expect(organizationAttrMap.cities).toBeDefined()

            const citiesSS: StringSetAttributeValue = organizationAttrMap.cities.SS
            expect(citiesSS).toBeDefined()
            expect(citiesSS.length).toBe(2)
            expect(citiesSS[0]).toBe('zürich')
            expect(citiesSS[1]).toBe('bern')
          })

          it('birthdays', () => {
            expect(organizationAttrMap.birthdays).toBeDefined()

            const birthdays: ListAttributeValue = organizationAttrMap.birthdays.L
            expect(birthdays).toBeDefined()
            expect(birthdays.length).toBe(2)

            expect(keyOf(birthdays[0])).toBe('M')

            // birthday 1
            const birthday1: MapAttributeValue = birthdays[0]['M']
            expect(birthday1['date']).toBeDefined()
            expect(keyOf(birthday1['date'])).toBe('S')
            expect(birthday1['date']['S']).toBe(birthday1Date.clone().utc().format())

            expect(birthday1['presents']).toBeDefined()
            expect(keyOf(birthday1['presents'])).toBe('L')
            expect(birthday1['presents']['L'].length).toBe(2)
            expect(keyOf(birthday1['presents']['L'][0])).toBe('M')

            expect(keyOf(birthday1['presents']['L'][0])).toBe('M')

            const birthday1gift1 = birthday1['presents']['L'][0]['M']
            expect(birthday1gift1['description']).toBeDefined()
            expect(keyOf(birthday1gift1['description'])).toBe('S')
            expect(birthday1gift1['description']['S']).toBe('ticket to rome')

            const birthday1gift2 = birthday1['presents']['L'][1]['M']
            expect(birthday1gift2['description']).toBeDefined()
            expect(keyOf(birthday1gift2['description'])).toBe('S')
            expect(birthday1gift2['description']['S']).toBe('camper van')

            // birthday 2
            const birthday2: MapAttributeValue = birthdays[1]['M']
            expect(birthday2['date']).toBeDefined()
            expect(keyOf(birthday2['date'])).toBe('S')
            expect(birthday2['date']['S']).toBe(birthday2Date.clone().utc().format())

            expect(birthday2['presents']).toBeDefined()
            expect(keyOf(birthday2['presents'])).toBe('L')
            expect(birthday2['presents']['L'].length).toBe(2)
            expect(keyOf(birthday2['presents']['L'][0])).toBe('M')

            expect(keyOf(birthday2['presents']['L'][0])).toBe('M')

            const birthday2gift1 = birthday2['presents']['L'][0]['M']
            expect(birthday2gift1['description']).toBeDefined()
            expect(keyOf(birthday2gift1['description'])).toBe('S')
            expect(birthday2gift1['description']['S']).toBe('car')

            const birthday2gift2 = birthday2['presents']['L'][1]['M']
            expect(birthday2gift2['description']).toBeDefined()
            expect(keyOf(birthday2gift2['description'])).toBe('S')
            expect(birthday2gift2['description']['S']).toBe('gin')
          })

          it('awards', () => {
            expect(organizationAttrMap.awards).toBeDefined()
            const awards: ListAttributeValue = organizationAttrMap.awards.L
            expect(awards).toBeDefined()
            expect(awards.length).toBe(2)

            expect(keyOf(awards[0])).toBe('S')
            expect(awards[0].S).toBe('good, better, shiftcode')

            expect(keyOf(awards[0])).toBe('S')
            expect(awards[1].S).toBe('jus kiddin')
          })

          it('events', () => {
            expect(organizationAttrMap.events).toBeDefined()
            const events: ListAttributeValue = organizationAttrMap.events.L
            expect(events).toBeDefined()
            expect(events.length).toBe(1)

            expect(keyOf(events[0])).toBe('M')
            expect(events[0]['M']['name']).toBeDefined()
            expect(keyOf(events[0]['M']['name'])).toBe('S')
            expect(events[0]['M']['name']['S']).toBe('shift the web')

            expect(events[0]['M']['participantCount']).toBeDefined()
            expect(keyOf(events[0]['M']['participantCount'])).toBe('N')
            expect(events[0]['M']['participantCount']['N']).toBe('1520')
          })

          it('transient', () => {
            expect(organizationAttrMap.transient).toBeUndefined()
          })
        })
      })

      describe('model with custom mapper', () => {
        it('should map using the custom mapper', () => {
          const model = new ModelWithCustomMapperModel()
          model.id = new Id(20, 2017)
          const toDb: AttributeMap<ModelWithCustomMapperModel> = Mapper.toDb(model, ModelWithCustomMapperModel)

          expect(toDb.id).toBeDefined()
          expect(keyOf(toDb.id)).toBe('S')
          expect(toDb.id.S).toBe('00202017')
        })
      })

      describe('model with autogenerated id', () => {
        it('should create an uuid', () => {
          const toDb: AttributeMap<ModelWithAutogeneratedId> = Mapper.toDb(
            new ModelWithAutogeneratedId(),
            ModelWithAutogeneratedId
          )
          expect(toDb.id).toBeDefined()
          expect(keyOf(toDb.id)).toBe('S')
          // https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
          expect(toDb.id.S).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        })

        it('should throw Error if a value was defined for property with uuid', () => {
          const model: ModelWithAutogeneratedId = new ModelWithAutogeneratedId()
          model.id = 'predefinedValue'
          expect(() => {
            Mapper.toDb(model, ModelWithAutogeneratedId)
          }).toThrow()
        })
      })

      describe('model with complex property values (decorators)', () => {
        let toDb: AttributeMap<Product>

        beforeEach(() => {
          toDb = Mapper.toDb(new Product(), Product)
        })

        it('nested value', () => {
          expect(toDb.nestedValue).toBeDefined()
          expect(toDb.nestedValue.M).toBeDefined()
          expect(Object.keys(toDb.nestedValue.M).length).toBe(1)
          expect(toDb.nestedValue.M['sortedSet']).toBeDefined()
          expect(keyOf(toDb.nestedValue.M['sortedSet'])).toBe('L')
        })

        it('list', () => {
          expect(toDb.list).toBeDefined()
          expect(keyOf(toDb.list)).toBe('L')
          expect(toDb.list.L.length).toBe(1)
          expect(keyOf(toDb.list.L[0])).toBe('M')
          // expect(Object.keys(toDb.list.L[0].M).length).toBe(1);
          expect(toDb.list.L[0].M.collection).toBeDefined()
          expect(keyOf(toDb.list.L[0].M.collection)).toBe('L')
        })
      })
    })

    describe('from db', () => {
      describe('model with complex property values (decorators)', () => {
        let product: Product

        beforeEach(() => {
          product = Mapper.fromDb(productFromDb, Product)
        })

        it('nested value', () => {
          expect(product.nestedValue).toBeDefined()
          expect(Object.getOwnPropertyNames(product.nestedValue).length).toBe(1)
          expect(product.nestedValue.sortedSet).toBeDefined()
          expect(product.nestedValue.sortedSet instanceof Set).toBeTruthy()
          expect(product.nestedValue.sortedSet.size).toBe(2)
        })
      })

      describe('model', () => {
        let organization: Organization

        beforeEach(() => {
          organization = Mapper.fromDb(organizationFromDb, Organization)
        })

        it('id', () => {
          expect(organization.id).toBe('myId')
        })

        it('createdAtDate', () => {
          expect(organization.createdAtDate).toBeDefined()
          expect(moment.isMoment(organization.createdAtDate)).toBeTruthy()
          expect((<moment.Moment>organization.createdAtDate).isValid()).toBeTruthy()
          expect((<moment.Moment>organization.createdAtDate).isSame(organization1CreatedAt)).toBeTruthy()
        })

        it('lastUpdated', () => {
          expect(organization.lastUpdated).toBeDefined()
          expect(moment.isMoment(organization.lastUpdated)).toBeTruthy()
          expect((<moment.Moment>organization.lastUpdated).isValid()).toBeTruthy()
          expect((<moment.Moment>organization.lastUpdated).isSame(organization1LastUpdated)).toBeTruthy()
        })

        it('employees', () => {
          expect(organization.employees).toBeDefined()
          expect(Array.isArray(organization.employees)).toBeTruthy()
          expect(organization.employees.length).toBe(2)

          // first employee
          expect(organization.employees[0].name).toBe('max')
          expect(organization.employees[0].age).toBe(50)
          expect(moment.isMoment(organization.employees[0].createdAt)).toBeTruthy()
          expect(
            (<moment.Moment>organization.employees[0].createdAt).isSame(organization1Employee1CreatedAt)
          ).toBeTruthy()

          // set is mapped to set but would expect list, should not work without extra @Sorted() decorator
          expect(organization.employees[0].sortedSet).toBeDefined()
          expect(organization.employees[0].sortedSet instanceof Set).toBeTruthy()

          // second employee
          expect(organization.employees[1].name).toBe('anna')
          expect(organization.employees[1].age).toBe(27)
          expect(moment.isMoment(organization.employees[1].createdAt)).toBeTruthy()
          expect(
            (<moment.Moment>organization.employees[1].createdAt).isSame(organization1Employee2CreatedAt)
          ).toBeTruthy()
          expect(organization.employees[1].sortedSet).toBeDefined()
          expect(organization.employees[1].sortedSet instanceof Set).toBeTruthy()
        })

        it('active', () => {
          expect(organization.active).toBe(true)
        })

        it('count', () => {
          expect(organization.count).toBe(52)
        })

        it('cities', () => {
          expect(organization.cities).toBeDefined()
          expect(organization.cities instanceof Set).toBeTruthy()

          const cities: Set<string> = organization.cities
          expect(cities.size).toBe(2)
          expect(Array.from(cities)[0]).toBe('zürich')
          expect(Array.from(cities)[1]).toBe('bern')
        })

        // it('awardWinningYears', () => {
        //   expect(organization.awardWinningYears).toBeDefined();
        //   expect(organization.awardWinningYears instanceof Set).toBeTruthy();
        //
        //   const awardWinningYears: Set<number> = organization.awardWinningYears;
        //   expect(awardWinningYears.size).toBe(3);
        //   expect(Array.from(awardWinningYears)[0]).toBe(2002);
        //   expect(Array.from(awardWinningYears)[1]).toBe(2015);
        //   expect(Array.from(awardWinningYears)[2]).toBe(2017);
        // });
        //
        // it('mixedList', () => {
        //   expect(organization.mixedList).toBeDefined();
        //   expect(Array.isArray(organization.mixedList)).toBeTruthy();
        //
        //   const mixedList: any[] = organization.mixedList;
        //   expect(mixedList.length).toBe(3);
        //   expect(mixedList[0]).toBe('sample');
        //   expect(mixedList[1]).toBe(26);
        //   expect(mixedList[2]).toBe(true);
        // });
        //
        // it('sortedSet', () => {
        //   expect(organization.setWithComplexSorted).toBeDefined();
        //   expect(organization.setWithComplexSorted instanceof Set).toBeTruthy();
        //
        //   const sortedSet: Set<string> = organization.setWithComplexSorted;
        //   expect(sortedSet.size).toBe(2);
        //   expect(Array.from(sortedSet)[0]).toBe('1');
        //   expect(Array.from(sortedSet)[1]).toBe('2');
        // });
      })
    })
  })
})

function keyOf(attributeValue: AttributeValue): string | null {
  if (attributeValue && Object.keys(attributeValue).length) {
    return Object.keys(attributeValue)[0]
  } else {
    return null
  }
}
