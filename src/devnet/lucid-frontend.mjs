import { C, PROTOCOL_PARAMETERS_DEFAULT } from "lucid-cardano"

export class LucidProviderFrontend {

  constructor(url) {
    this.url = url
    this.nextId = 0
    this.queue = {}
  }

  async init() {
    return new Promise(resolve => {
      this.sock = new WebSocket(this.url)
      this.sock.onopen = () => {
        console.log("Provider connected")
        resolve()
      }
      this.sock.onerror = err => {
        console.log("Provider error: " + err.message)
      }
      this.sock.onmessage = async msg => {
        const obj = JSON.parse(msg.data)
        if (this.queue[obj.id] !== undefined) {
          if (obj.error !== undefined) {
            console.error("Error: " + obj.error)
            await this.queue[obj.id](obj.error)
          } else {
            await this.queue[obj.id](obj.result)
            delete this.queue[obj.id]
          }
        }
      }
    })
  }

  async query(obj) {
    obj.jsonrpc = "2.0"
    obj.id = this.nextId++
    this.sock.send(JSON.stringify(obj))
    return new Promise(resolve => {
      this.queue[obj.id] = resolve
    })
  }

  async getProtocolParameters() {
    return PROTOCOL_PARAMETERS_DEFAULT
  }

  async waitBlock() {
    await this.query({
      method: "waitBlock"
    })
  }

  async getJambhalaAddr(name) {
    const obj = await this.query({
      method: "getJambhalaAddr",
      params: {
        name: name
      }
    })
    if (obj.name === name) {
      return obj.addr
    }
  }

  async getJambhalaPrivKey(name) {
    const obj = await this.query({
      method: "getJambhalaPrivKey",
      params: {
        name: name
      }
    })
    console.log("obj=" + JSON.stringify(obj, null, 2))
    if (obj.name === name) {
      return obj.priv
    }
  }

  async getUtxos(addressOrCredential) {
    if (typeof addressOrCredential === "string") {
      const obj = await this.query({
        method: "getUtxos",
        params: {
          address: addressOrCredential
        }
      })
      //console.log(JSON.stringify(obj, null, 2))
      return obj
    } else {
      const credentialBech32 = addressOrCredential.type === "Key"
        ? C.Ed25519KeyHash.from_hex(addressOrCredential.hash).to_bech32("addr_test") :
        C.ScriptHash.from_hex(addressOrCredential.hash).to_bech32("addr_test")
      const obj = await this.query({
        method: "getUtxos",
        params: {
          credential: credentialBech32
        }
      })
      //console.log(JSON.stringify(obj, null, 2))
      return obj
    }
  }

  async getUtxosWithUnit(addressOrCredential, unit) {
    if (typeof addressOrCredential === "string") {
      const obj = await this.query({
        method: "getUtxosWithUnit",
        params: {
          address: addressOrCredential,
          unit: unit
        }
      })
      //console.log(JSON.stringify(obj, null, 2))
      return obj
    } else {
      const credentialBech32 = addressOrCredential.type === "Key"
        ? C.Ed25519KeyHash.from_hex(addressOrCredential.hash).to_bech32("addr_test") :
        C.ScriptHash.from_hex(addressOrCredential.hash).to_bech32("addr_test")
      const obj = await this.query({
        method: "getUtxosWithUnit",
        params: {
          credential: credentialBech32,
          unit: unit
        }
      })
      //console.log(JSON.stringify(obj, null, 2))
      return obj
    }
  }

  async getUtxosByOutRef(outrefs) {
    const obj = await this.query({
      method: "getUtxosByOutRef",
      params: {
        outrefs: outrefs
      }
    })
    return obj
  }
  
  async getUtxoByUnit(unit) {
    const obj = await this.query({
      method: "getUtxoByUnit",
      params: {
        unit: unit
      }
    })
    return obj
  }

  async getDelegation(rewardAddress) {
    const obj = await this.query({
      method: "getDelegation",
      params: {
        rewardAddress: rewardAddress
      }
    })
    return obj
  }

  async getDatum(datumHash) {
    const obj = await this.query({
      method: "getDatum",
      params: {
        datumHash: datumHash
      }
    })
    return obj
  }

  async awaitTx(txHash) {
    const obj = await this.query({
      method: "getDatum",
      params: {
        txHash: txHash
      }
    })
    return obj
  }

  async submitTx(tx) {
    return await this.query({
      method: "submitTx",
      params: {
        cbor: tx
      }
    })
  }

}