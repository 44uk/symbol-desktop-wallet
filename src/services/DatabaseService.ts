/**
 * 
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
import {Password} from 'nem2-sdk'

// internal dependencies
import {IService} from '@/core/services/IService'
import {DatabaseModel} from '@/core/services/database/DatabaseModel'
import {BaseStorageAdapter} from '@/core/services/database/BaseStorageAdapter'
import {SimpleStorageAdapter} from '@/core/services/database/SimpleStorageAdapter'
import {LocalStorageBackend} from '@/core/services/database/backends/LocalStorageBackend'
import {JSONFormatter} from '@/core/services/database/formatters/JSONFormatter'

export class DatabaseService implements IService {
  /**
   * Service name
   * @var {string}
   */
  public name: string = 'database'

  /**
   * Get the database adapter
   * @return {SimpleStorageAdapter<ModelImpl>}
   */
  public getAdapter<ModelImpl extends DatabaseModel>(): SimpleStorageAdapter<ModelImpl> {
    return new SimpleStorageAdapter<ModelImpl>(
      new LocalStorageBackend(),
      new JSONFormatter<ModelImpl>(),
    )
  }
}
