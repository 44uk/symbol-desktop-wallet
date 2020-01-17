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
import {
  SimpleWallet,
  NetworkType
} from 'nem2-sdk'

// internal dependencies
import {DatabaseModel} from '@/core/services/database/DatabaseModel'
import {DatabaseTable} from '@/core/services/database/DatabaseTable'
import {DatabaseService} from '@/core/services/database/DatabaseService'
import { SimpleStorageAdapter } from '../services/database/SimpleStorageAdapter'

/// region database entities
export class WalletsModel extends DatabaseModel {
  /**
   * Entity identifier *field name*
   * @var {string}
   */
  public primaryKey: string = 'address'
}

export class WalletsTable extends DatabaseTable {
  public constructor() {
    super('wallets', [
      'type',
      'address',
      'publicKey',
      'encPrivate',
      'path',
      'name',
    ])
  }

  /**
   * Create a new model instance
   * @return {WalletsModel}
   */
  public createModel(): WalletsModel {
    return new WalletsModel()
  }
}
/// end-region database entities

export class AppWalletType {
  public static readonly SEED: number = 1
  public static readonly PRIVATE_KEY = 2
  public static readonly KEYSTORE = 3
  public static readonly TREZOR = 4

  public static fromDescriptor(descriptor: string) {
    switch(descriptor) {
    default:
    case 'Ks': return AppWalletType.KEYSTORE
    case 'Pk': return AppWalletType.PRIVATE_KEY
    case 'Seed': return AppWalletType.SEED
    case 'Trezor': return AppWalletType.TREZOR
    }
  }
}

export class AppWallet {
  /**
   * Model instance
   * @var {WalletsModel}
   */
  public model: WalletsModel

  /**
   * Database service
   * @var {DatabaseService}
   */
  protected dbService: DatabaseService = new DatabaseService()

  /**
   * Storage adapter
   * @var {SimpleStorageAdapter<WalletsModel>}
   */
  protected adapter: SimpleStorageAdapter<WalletsModel>

  constructor(
    public name: string,
    public simpleWallet: SimpleWallet,
    public address: string,
    public publicKey: string,
    public path: string,
    public sourceType: string,
    public networkType: NetworkType,
    public active: boolean,
    public encryptedMnemonic: string,
  ) {
    this.adapter = this.dbService.getAdapter<WalletsModel>()

    // populate model
    this.model = new WalletsModel(new Map<string, any>([
      ['name', this.name],
      ['type', AppWalletType.fromDescriptor(this.sourceType)],
      ['address', this.address],
      ['publicKey', this.publicKey],
      ['encPrivate', simpleWallet.encryptedPrivateKey],
      ['path', this.path],
      ['networkType', this.networkType]
    ]))
  }

/*
  name: string
  simpleWallet: SimpleWallet
  address: string
  publicKey: string
  path: string
  sourceType: string

  // Should use AppAccount
  networkType: NetworkType
  active: boolean
  encryptedMnemonic: string

  // Should use store
  importance: number
  linkedAccountKey: string
  remoteAccount: RemoteAccount | null
  numberOfMosaics: number

  // Remove
  temporaryRemoteNodeConfig: {
    publicKey: string
    node: string
  } | null

  constructor(wallet?: {
    name?: string
    simpleWallet?: SimpleWallet
  }) {
    Object.assign(this, wallet)
  }
*/
}
