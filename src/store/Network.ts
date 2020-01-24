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
import {NetworkType, Listener} from 'nem2-sdk';
import {Subscription} from 'rxjs'

// internal dependencies
import {$eventBus} from '../main'
import {RESTService} from '@/services/RESTService'
import {URLHelpers} from '@/core/utils/URLHelpers';
import {AwaitLock} from './AwaitLock';
const Lock = AwaitLock.create();

// configuration
import networkConfig from '../../config/network.conf.json';

/// region custom types
/**
 * Type SubscriptionType for Wallet Store
 * @type {SubscriptionType}
 */
type SubscriptionType = {listener: Listener, subscriptions: Subscription[]}
/// end-region custom types

export default {
  namespaced: true,
  state: {
    initialized: false,
    wsEndpoint: '',
    config: networkConfig,
    defaultPeer: URLHelpers.formatUrl(networkConfig.defaultNode.url),
    currentPeer: URLHelpers.formatUrl(networkConfig.defaultNode.url),
    explorerUrl: networkConfig.explorerUrl,
    networkType: NetworkType.MIJIN_TEST,
    isConnected: false,
    nemesisTransactions: [],
    knownPeers: networkConfig.networks['testnet-publicTest'].nodes,
    currentHeight: 0,
    // Subscriptions to websocket channels.
    subscriptions: [],
  },
  getters: {
    getInitialized: state => state.initialized,
    getSubscriptions: state => state.subscriptions,
    wsEndpoint: state => state.wsEndpoint,
    networkType: state => state.networkType,
    currentPeer: state => state.currentPeer,
    currentPeerInfo: state => state.currentPeerInfo,
    explorerUrl: state => state.explorerUrl,
    isConnected: state => state.isConnected,
    knownPeers: state => state.knownPeers,
    currentHeight: state => state.currentHeight,
  },
  mutations: {
    setInitialized: (state, initialized) => { state.initialized = initialized },
    setConnected: (state, connected) => { state.isConnected = connected },
    currentHeight: (state, height) => Vue.set(state, 'currentHeight', height),
    currentPeerInfo: (state, info) => Vue.set(state, 'currentPeerInfo', info),
    currentPeer: (state, payload) => {
      if (undefined !== payload) {
        let currentPeer = URLHelpers.formatUrl(payload)
        let wsEndpoint = URLHelpers.httpToWsUrl(currentPeer.url)
        Vue.set(state, 'currentPeer', currentPeer)
        Vue.set(state, 'wsEndpoint', wsEndpoint)
      }
    },
    addPeer: (state, peerUrl) => {
      const knownPeers = state.knownPeers
      knownPeers.push(peerUrl)
      Vue.set(state, 'knownPeers', knownPeers)
    },
    removePeer: (state, peerUrl) => {
      const idx = state.knownPeers.findIndex(peerUrl)
      if (idx === undefined) {
        return ;
      }

      const knownPeers = state.knownPeers
      delete knownPeers[idx]
      Vue.set(state, 'knownPeers', knownPeers)
    },
    resetPeers: (state) => {
      const knownPeers = networkConfig.networks['testnet-publicTest'].nodes
      Vue.set(state, 'knownPeers', knownPeers)
    },
    networkType: (state, type) => {
      switch (type) {
        case NetworkType.MIJIN_TEST:
        case NetworkType.MIJIN:
        case NetworkType.TEST_NET:
        case NetworkType.MAIN_NET:
          Vue.set(state, 'networkType', type)
          break;

        default:
          Vue.set(state, 'networkType', NetworkType.MIJIN_TEST)
          break;
      }
    },
    setNemesisTransactions: (state, transactions) => Vue.set(state, 'nemesisTransactions', transactions),
    setSubscriptions: (state, data) => Vue.set(state, 'subscriptions', data),
    addSubscriptions: (state, payload) => {
      if (payload && payload.length) {
        const subscriptions = state.subscriptions
        subscriptions.push(payload)

        Vue.set(state, 'subscriptions', subscriptions)
      }
    },
  },
  actions: {
    async initialize({ commit, dispatch, getters }) {
      const callback = async () => {
        const nodeUrl = getters.currentPeer.url
        try {
          // read network type ("connect")
          const networkHttp = RESTService.create('NetworkHttp', nodeUrl)
          const chainHttp = RESTService.create('ChainHttp', nodeUrl)
          const nodeHttp = RESTService.create('NodeHttp', nodeUrl)
          const networkType = await networkHttp.getNetworkType().toPromise()

          // update connection state
          commit('setConnected', true)
          $eventBus.$emit('newConnection', nodeUrl);

          const peerInfo = await nodeHttp.getNodeInfo().toPromise()
          const currentHeight = await chainHttp.getBlockchainHeight().toPromise()

          // update store
          commit('networkType', networkType)
          commit('currentHeight', currentHeight.compact())
          commit('currentPeerInfo', peerInfo)
          commit('setInitialized', true)

          // subscribe to updates
          dispatch('SUBSCRIBE')
        }
        catch (e) {
          console.log("Error in Store network/initialize: ", e)
        }
      }

      // aquire async lock until initialized
      await Lock.initialize(callback, {commit, dispatch, getters})
    },
    async uninitialize({ commit, dispatch, getters }) {
      const callback = async () => {
        dispatch('UNSUBSCRIBE')
        commit('setInitialized', false)
      }
      await Lock.uninitialize(callback, {commit, dispatch, getters})
    },
/// region scoped actions
    async SET_CURRENT_PEER({ commit, dispatch }, currentPeerUrl) {
      if (!URLHelpers.isValidURL(currentPeerUrl)) {
        throw Error('Cannot change node. URL is not valid: ' + currentPeerUrl)
      }

      // update state pre-connection
      commit('currentPeer', currentPeerUrl)
      commit('setConnected', false)
      commit('setInitialized', false)

      // reset store + re-initialize
      await dispatch('uninitialize', null, {root: true})
      await dispatch('initialize')
    },
    ADD_KNOWN_PEER({commit}, peerUrl) {
      if (!URLHelpers.isValidURL(peerUrl)) {
        throw Error('Cannot add node. URL is not valid: ' + peerUrl)
      }

      commit('addPeer', peerUrl)
    },
    REMOVE_KNOWN_PEER({commit}, peerUrl) {
      commit('removePeer', peerUrl)
    },
    RESET_PEERS({commit}) {
      commit('resetPeers')
    },
    RESET_SUBSCRIPTIONS({commit}) {
      commit('setSubscriptions', [])
    },
/**
 * Websocket API
 */
    // Subscribe to latest account transactions.
    async SUBSCRIBE({ commit, dispatch, getters }) {
      // use RESTService to open websocket channel subscriptions
      const websocketUrl = getters['/wsEndpoint']
      const subscriptions: SubscriptionType  = await RESTService.subscribeBlocks(
        {commit, dispatch},
        websocketUrl,
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
    SET_CURRENT_HEIGHT({commit}, height) {
      commit('currentHeight', height)
    }
/// end-region scoped actions
  }
};
