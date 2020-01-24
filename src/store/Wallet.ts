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
import Vue from 'vue';
import {
  Address,
  QueryParams,
  Listener,
  Mosaic,
  UInt64,
} from 'nem2-sdk'
import {Subscription} from 'rxjs'

// internal dependencies
import {$eventBus} from '../main'
import {CacheKey} from '@/core/utils/CacheKey'
import {RESTService} from '@/services/RESTService'
import {WalletsRepository} from '@/repositories/WalletsRepository'
import {AwaitLock} from './AwaitLock';

/**
 * Helper to format transaction group in name of state variable.
 *
 * @internal
 * @param {string} group 
 * @return {string} One of 'confirmedTransactions', 'unconfirmedTransactions' or 'partialTransactions'
 */
const transactionGroupToStateVariable = (
  group: string
): string => {
  let transactionGroup = group.toLowerCase();
  if (transactionGroup === 'unconfirmed'
      || transactionGroup === 'confirmed'
      || transactionGroup === 'partial') {
    transactionGroup = transactionGroup + 'Transactions'
  }
  else {
    throw new Error('Unknown transaction group \'' + group + '\'.')
  }

  return transactionGroup
}

/// region globals
const Lock = AwaitLock.create();
const walletsRepository = new WalletsRepository()
/// end-region globals

/**
 * Type SubscriptionType for Wallet Store
 * @type {SubscriptionType}
 */
type SubscriptionType = {listener: Listener, subscriptions: Subscription[]}

/**
 * Wallet Store
 */
export default {
  namespaced: true,
  state: {
    initialized: false,
    currentWallet: '',
    currentWalletAddress: null,
    currentWalletInfo: null,
    currentWalletMosaics: [],
    otherWalletsInfo: {},
    allTransactions: [],
    transactionHashes: [],
    confirmedTransactions: [],
    unconfirmedTransactions: [],
    partialTransactions: [],
    transactionCache: {},
    // Subscriptions to websocket channels.
    subscriptions: [],
  },
  getters: {
    getInitialized: state => state.initialized,
    currentWallet: state => state.currentWallet,
    currentWalletAddress: state => state.currentWalletAddress,
    currentWalletInfo: state => state.currentWalletInfo,
    currentWalletMosaics: state => state.currentWalletMosaics,
    otherWalletsInfo: state => state.otherWalletsInfo,
    getSubscriptions: state => state.subscriptions,
    transactionHashes: state => state.transactionHashes,
    confirmedTransactions: state => state.confirmedTransactions,
    unconfirmedTransactions: state => state.unconfirmedTransactions,
    partialTransactions: state => state.partialTransactions,
    transactionCache: state => state.transactionCache,
    allTransactions: state => {
      return [].concat(
        state.confirmedTransactions,
        state.unconfirmedTransactions,
        state.partialTransactions,
      )
    },
  },
  mutations: {
    setInitialized: (state, initialized) => { state.initialized = initialized },
    currentWallet: (state, walletName) => Vue.set(state, 'currentWallet', walletName),
    currentWalletAddress: (state, walletAddress) => Vue.set(state, 'currentWalletAddress', walletAddress),
    currentWalletInfo: (state, currentWalletInfo) => Vue.set(state, 'currentWalletInfo', currentWalletInfo),
    currentWalletMosaics: (state, currentWalletMosaics) => Vue.set(state, 'currentWalletMosaics', currentWalletMosaics),
    addWalletInfo: (state, walletInfo) => {
      // update storage
      let wallets = state.otherWalletsInfo
      wallets[walletInfo.address.plain()] = walletInfo

      // update state
      Vue.set(state, 'otherWalletsInfo', wallets)
    },
    transactionHashes: (state, hashes) => Vue.set(state, 'transactionHashes', hashes),
    confirmedTransactions: (state, transactions) => Vue.set(state, 'confirmedTransactions', transactions),
    unconfirmedTransactions: (state, transactions) => Vue.set(state, 'unconfirmedTransactions', transactions),
    partialTransactions: (state, transactions) => Vue.set(state, 'partialTransactions', transactions),
    setSubscriptions: (state, data) => Vue.set(state, 'subscriptions', data),
    addSubscriptions: (state, payload) => {
      if (payload && payload.length) {
        const subscriptions = state.subscriptions
        subscriptions.push(payload)

        Vue.set(state, 'subscriptions', subscriptions)
      }
    },
    addTransactionToCache: (state, payload) => {
      if (payload === undefined) {
        return ;
      }

      // if unknown cache key, JiT creation of collection
      const key  = payload.cacheKey
      const cache = state.transactionCache
      if (! cache.hasOwnProperty(key)) {
        cache[key] = []
      }

      // add transaction to cache
      const hash  = payload.hash
      cache[key].push({hash, transaction: payload.transaction})

      // update state
      Vue.set(state, 'transactionCache', cache)
      return cache
    } 
  },
  actions: {
    async initialize({ commit, dispatch, getters }, address) {
      const callback = async () => {
        if (!address || !address.length) {
            return ;
        }

        // fetch account info
        dispatch('REST_FETCH_INFO', address)

        // open websocket connections
        dispatch('SUBSCRIBE', address)
        dispatch('RESET_TRANSACTIONS')
        commit('setInitialized', true)
      }
      await Lock.initialize(callback, {commit, dispatch, getters})
    },
    async uninitialize({ commit, dispatch, getters }) {
      const callback = async () => {
        // close websocket connections
        dispatch('UNSUBSCRIBE')
        dispatch('RESET_TRANSACTIONS')
        commit('setInitialized', false)
      }
      await Lock.uninitialize(callback, {commit, dispatch, getters})
    },
/// region scoped actions
    async SET_CURRENT_WALLET({commit, dispatch}, walletName) {

      const currentWallet = walletsRepository.read(walletName)
      commit('currentWallet', walletName)
      commit('currentWalletAddress', currentWallet.address())

      // reset store + re-initialize
      await dispatch('uninitialize', null, {root: true})
      await dispatch('initialize')
      $eventBus.$emit('onWalletChange', walletAddress)
    },
    SET_BALANCES({commit, dispatch, rootGetters}, mosaics) {
      // - read network mosaic
      const networkMosaic = rootGetters['mosaic/networkMosaic']

      // - if there is no mosaics, add network mosaic balance 0
      if (! mosaics.length) {
        mosaics = [new Mosaic(networkMosaic, UInt64.fromUint(0))]
      }
      // - if there is mosaics, set network mosaic on top
      else {
        const currency = mosaics.filter(m => m.id.equals(networkMosaic)).shift()
        mosaics = [currency].concat(mosaics.find(m => !m.id.equals(networkMosaic)) || [])
      }

      commit('currentWalletMosics', mosaics)
    },
    RESET_SUBSCRIPTIONS({commit}) {
      commit('setSubscriptions', [])
    },
    RESET_TRANSACTIONS({commit}) {
      commit('confirmedTransactions', [])
      commit('unconfirmedTransactions', [])
      commit('partialTransactions', [])
    },
    ADD_TRANSACTION({commit, getters}, transactionMessage) {
      if (!transactionMessage || !transactionMessage.group) {
        throw Error('Missing mandatory field \'group\' for action wallet/addTransaction.')
      }

      // format transactionGroup to store variable name
      let transactionGroup = transactionGroupToStateVariable(transactionMessage.group);

      // if transaction hash is known, do nothing
      const hashes = getters['transactionHashes']
      const transaction = transactionMessage.transaction
      const findIterator = hashes.find(hash => hash === transaction.transactionInfo.hash)
      if (findIterator !== undefined) {
        return ; // transaction already known
      }

      // register transaction
      const transactions = getters[transactionGroup]
      transactions.push(transaction)
      hashes.push(transaction.transactionInfo.hash)

      // update state
      commit('addTransactionToCache', {hash: transaction.transactionInfo.hash, transaction})
      commit(transactionGroup, transactions)
      return commit('transactionHashes', hashes)
    },
    REMOVE_TRANSACTION({commit, getters}, transactionMessage) {
      if (!transactionMessage || !transactionMessage.group) {
        throw Error('Missing mandatory field \'group\' for action wallet/removeTransaction.')
      }

      // format transactionGroup to store variable name
      let transactionGroup = transactionGroupToStateVariable(transactionMessage.group);

      // read from store
      const hashes = getters['transactionHashes']
      const transactions = getters[transactionGroup]

      // prepare search
      const transaction = transactionMessage.transaction
      const transactionHash = transaction.meta.hash

      // find transaction in storage
      const findHashIt = hashes.find(hash => hash === transactionHash)
      const findIterator = transactions.find(tx => tx.meta.hash === transactionHash)
      if (findIterator === undefined) {
        return ; // not found, do nothing
      }

      // remove transaction
      delete transactions[findIterator]
      delete hashes[findHashIt]
      commit(transactionGroup, transactions)
      return commit('transactionHashes', hashes)
    },
/**
 * Websocket API
 */
    // Subscribe to latest account transactions.
    async SUBSCRIBE({ commit, dispatch, rootGetters }, address) {
      if (!address || !address.length) {
        return ;
      }

      // use RESTService to open websocket channel subscriptions
      const websocketUrl = rootGetters['network/wsEndpoint']
      const subscriptions: SubscriptionType  = await RESTService.subscribeTransactionChannels(
        {commit, dispatch},
        websocketUrl,
        address,
      )

      // update state of listeners & subscriptions
      commit('addSubscriptions', subscriptions)
    },

    // Unsubscribe from all open websocket connections
    UNSUBSCRIBE({ dispatch, getters }) {
      const subscriptions = getters.getSubscriptions
      subscriptions.map((subscription: SubscriptionType) => {
        // unsubscribe channels
        subscription.subscriptions.map(sub => sub.unsubscribe())

        // close listener
        subscription.listener.close()
      })

      // update state
      dispatch('RESET_SUBSCRIPTIONS')
    },
/**
 * REST API
 */
    async REST_FETCH_TRANSACTIONS({dispatch, getters, rootGetters}, {address, pageSize, id}) {
      if (!address || address.length !== 40) {
        return ;
      }

      // check cache for results
      const cacheKey = CacheKey.create([address, pageSize, id])
      const cache = getters['transactionCache']
      if (cache.hasOwnProperty(cacheKey)) {
        return cache[cacheKey]
      }

      try {
        // prepare REST parameters
        const currentPeer = rootGetters['network/currentPeer'].url
        const queryParams = new QueryParams(pageSize, id)
        const addressObject = Address.createFromRawAddress(address)
        
        // fetch transactions from REST gateway
        const accountHttp = RESTService.create('AccountHttp', currentPeer)
        const transactions = await accountHttp.getAccountTransactions(addressObject, queryParams).toPromise()

        // update store
        transactions.map((transaction) => dispatch('ADD_TRANSACTION', {
          group: 'confirmed',
          cacheKey: cacheKey,
          transaction
        }))

        return transactions
      }
      catch (e) {
        console.error('An error happened while trying to fetch transactions: ' + e)
        return false
      }
    },
    async REST_FETCH_INFO({commit, dispatch, getters, rootGetters}, address) {
      if (!address || address.length !== 40) {
        return ;
      }

      try {
        // prepare REST parameters
        const currentPeer = rootGetters['network/currentPeer'].url
        const addressObject = Address.createFromRawAddress(address)

        // fetch account info from REST gateway
        const accountHttp = RESTService.create('AccountHttp', currentPeer)
        const accountInfo = await accountHttp.getAccountInfo(addressObject).toPromise()

        commit('addWalletInfo', accountInfo)

        if (address === getters['currentWallet'])
        commit('currentWalletInfo', accountInfo)
        dispatch('SET_BALANCES', accountInfo.mosaics)
        return accountInfo
      }
      catch (e) {
        console.error('An error happened while trying to fetch account information: <pre>' + e + '</pre>')
        return false
      }
    },
    async REST_FETCH_INFOS({commit, rootGetters}, addresses) {
      try {
        // prepare REST parameters
        const currentPeer = rootGetters['network/currentPeer'].url

        // fetch account info from REST gateway
        const accountHttp = RESTService.create('AccountHttp', currentPeer)
        const accountsInfo = await accountHttp.getAccountsInfo(addresses).toPromise()
        accountsInfo.map(info => commit('addWalletInfo', info))
        return accountsInfo
      }
      catch (e) {
        console.error('An error happened while trying to fetch account information: <pre>' + e + '</pre>')
        return false
      }
    },
/// end-region scoped actions
  },
};
