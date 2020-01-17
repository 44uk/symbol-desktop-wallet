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
import {IStorageAdapter} from './IStorageAdapter'
import {DatabaseTable} from './DatabaseTable'
import {DatabaseModel} from './DatabaseModel'
import {IStorageBackend} from './backends/IStorageBackend'
import {LocalStorageBackend} from './backends/LocalStorageBackend'
import {ObjectStorageBackend} from './backends/ObjectStorageBackend'
import {IDataFormatter} from './formatters/IDataFormatter'
import {JSONFormatter} from './formatters/JSONFormatter'

export abstract class BaseStorageAdapter<ModelImpl extends DatabaseModel> 
  implements IStorageAdapter<string> {
  /**
   * Storage backend
   * @var {IStorageBackend}
   */
  public readonly storage: IStorageBackend

  /**
   * Data formatter
   * @var {IDataFormatter<ModelImpl, string>}
   */
  public readonly formatter: IDataFormatter<ModelImpl, string>

  /**
   * List of database table schemas
   * @var {Map<string, DatabaseTable}
   */
  public schemas: Map<string, DatabaseTable>

  /**
   * Private constructor (singleton pattern)
   * @access private
   */
  public constructor(
    storageBackend: IStorageBackend = !!localStorage ? new LocalStorageBackend() : new ObjectStorageBackend(),
    dataFormatter: IDataFormatter<ModelImpl, string> = new JSONFormatter<ModelImpl>()
  ) {
    this.storage = storageBackend
    this.formatter = dataFormatter
    this.schemas = new Map<string, DatabaseTable>()
  }

  /**
   * Getter for table schemas
   * @return {BaseStorageAdapter<ModelImpl>}
   */
  public setSchemas(schemas: Map<string, DatabaseTable>): BaseStorageAdapter<ModelImpl> {
    this.schemas = schemas
    return this
  }

  /**
   * Read and parse data for schema with \a schemaId
   * @param {string} schemaId 
   * @return {Map<string, ModelImpl>}
   */
  public read(schemaId: string): Map<string, ModelImpl> {
    // catch unregistered schema
    if (!this.schemas.has(schemaId)) {
      throw new Error('Schema with identifier \'' + schemaId + '\' is not registered.')
    }

    // read schema from storage backend
    const schema = this.schemas.get(schemaId)
    const data = this.storage.getItem(schema.tableName) || ''

    // valid stored data to identify invalid data format
    if (!this.formatter.validate(data)) {
      throw new Error('Data stored for schema \'' + schemaId + '\' does not comply with IDataFormatter derivate.')
    }

    // map on-the-fly + validate singular entities format
    return this.formatter.parse(data)
  }

  /**
   * Read and parse data for schema with \a schemaId
   * @param {Map<string, ModelImpl>} entities
   * @return {number} The count of entities written
   */
  public write(schemaId: string, entities: Map<string, ModelImpl>): number {
    // catch unregistered schema
    if (!this.schemas.has(schemaId)) {
      throw new Error('Schema with identifier \'' + schemaId + '\' is not registered.')
    }

    // format data
    const schema = this.schemas.get(schemaId)
    const data = this.formatter.format(entities)

    // persist formatted data
    this.storage.setItem(schemaId, data)
    return entities.size
  }
}
