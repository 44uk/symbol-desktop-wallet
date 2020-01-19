/**
 * Copyright 2020 NEM Foundation (https://nem.io)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// internal dependencies
import {DatabaseRelation} from './DatabaseRelation'
import {IRepository} from '@/repositories/IRepository'

export class DatabaseModel {
  /**
   * Entity identifier *field names*. The identifier
   * is a combination of the values separated by '-'
   * @var {string[]}
   */
  public primaryKeys: string[]

  /** 
   * Entity relationships
   * @var {Map<string, DatabaseRelation>}
   */
  public relations: Map<string, DatabaseRelation>

  /**
   * Values of the model instance
   * @var {Map<string, any>}
   */
  public values: Map<string, any>

  /**
   * Whether the current instance has dirty fields
   * @var {boolean}
   */
  public isDirty: boolean

  /**
   * Entity identifier
   * @var {string}
   */
  public identifier: string

  /**
   * Construct a database model instance
   * @param tableName 
   * @param columns 
   * @param types 
   */
  public constructor(
    values: Map<string, any> = new Map<string, any>()
  ) {
    this.values = values
    this.identifier = this.getIdentifier()
    this.isDirty = false
  }

  /**
   * Getter for the *row* identifier
   * @return {string}
   */
  public getIdentifier(): string {
    if (!this.primaryKeys.length) {
      throw new Error('Primary keys must be described in derivate DatabaseModel classes.')
    }

    return this.primaryKeys.map(pk => this.values.get(pk)).join('-')
  }

  /**
   * Returns true when all primary key *values* are set
   * @return {boolean}
   */
  public hasIdentifier(): boolean {
    if (!this.primaryKeys.length) {
      throw new Error('Primary keys must be described in derivate DatabaseModel classes.')
    }

    // check value of *all* primary keys
    for (let i = 0, m = this.primaryKeys.length; i < m; i++) {
      if (! this.values.has(this.primaryKeys[i])) {
        return false
      }
    }

    return true
  }

  /**
   * Update values
   * @param {Map<string, any>} values 
   * @return {DatabaseModel}
   * @throws {Error} On overwrite of primary key with different value
   */
  public update(values: Map<string, any>): DatabaseModel {
    this.values = values
    this.isDirty = true
    return this
  }

  /**
   * Update one field's value
   * @param {string} field
   * @param {any} value
   * @return {DatabaseModel}
   */
  public updateField(field: string, value: any): DatabaseModel {
    this.values.set(field, value)
    this.isDirty = true
    return this
  }

  /**
   * Fetch many relations
   * @access protected
   * @param {IRepository<ModelImpl>} repository 
   * @param {string} fieldName
   * @return {Map<string, ModelImpl>} Collection of objects mapped by identifier
   */
  protected fetchRelations<ModelImpl extends DatabaseModel>(
    repository: IRepository<ModelImpl>,
    fieldName: string
  ): Map<string, ModelImpl> {
    const resolved = new Map<string, ModelImpl>()

    // resolve object by identifier list stored in values
    // with field name \a fieldName
    for (const identifier in this.values.get(fieldName)) {
      resolved.set(identifier, repository.read(identifier))
    }

    return resolved
  }

  /**
   * Fetch one relation
   * @access protected
   * @param {IRepository<ModelImpl>} repository 
   * @param {string} fieldName
   * @return {ModelImpl} Collection of objects mapped by identifier
   */
  protected fetchRelation<ModelImpl extends DatabaseModel>(
    repository: IRepository<ModelImpl>,
    fieldName: string
  ): ModelImpl {
    return repository.read(this.values.get(fieldName))
  }
}
