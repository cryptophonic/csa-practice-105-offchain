import fs from 'fs'
import { describe, it, expect, test } from "vitest";
import { Data, Lucid, Script, fromText, paymentCredentialOf } from 'lucid-cardano'
import { LucidProviderFrontend } from "../src/devnet/lucid-frontend.mjs"
import { fromAddress, toAddress } from "../src/utils.js"
import { MarketRedeemer, SimpleSale } from "../src/contract-schema.js"

const validator = JSON.parse(fs.readFileSync("./contracts/MarketPlace.json").toString())
const marketPlaceScript: Script = {
  type: "PlutusV2",
  script: validator.cborHex
}

test("fund Bob from faucet", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("faucet"))

  const bob = await provider.getJambhalaAddr("bob")
  const tx = await lucid.newTx()
    .payToAddress(bob, { lovelace: 100_000_000n })
    .complete()

  const signedTx = await tx.sign().complete()
  const txHash = await signedTx.submit()
  await provider.waitBlock()
})

test("mint NFT for Bob", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("bob"))

  const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
  if (paymentCredential !== undefined) {
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    const tx = await lucid.newTx()
      .mintAssets({ [unit]: 100n })
      .attachMintingPolicy(mintingPolicy)
      .complete()

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  }
})

test("transfer NFT and funds to Alice", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  const alice = await provider.getJambhalaAddr("alice")
  console.log("alice addr=" + alice)
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("bob"))

  const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
  if (paymentCredential !== undefined) {
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    const tx = await lucid.newTx()
      .payToAddress(alice, { lovelace: 5_000_000n, [unit]: 10n })
      .complete();

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  }
})

test("Alice sells NFT", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  const bob = await provider.getJambhalaAddr("bob")
  const validatorAddress = lucid.utils.validatorToAddress(marketPlaceScript)
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("alice"))

  const { paymentCredential } = lucid.utils.getAddressDetails(bob)
  if (paymentCredential !== undefined) {  
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    // Alice offers 1 NFT for sale
    const tx = await lucid.newTx()
      .payToContract(validatorAddress, { 
          inline: Data.to({
            sellerAddress: fromAddress(await lucid.wallet.address()),
            priceOfAsset: 1_500_000n
          }, SimpleSale)
        }, { 
          [unit]: 1n
        })
      .complete()

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  }
})

test("Bob buys NFT", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  const validatorAddress = lucid.utils.validatorToAddress(marketPlaceScript)
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("bob"))

  const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address())
  if (paymentCredential !== undefined) {  
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    const utxos = await provider.getUtxosWithUnit(validatorAddress, unit)
    const utxo = utxos[0]
    console.log(JSON.stringify(utxo, null, 2))

    const simpleSale = Data.from(utxo.datum, SimpleSale)
    const sellerAddress = toAddress(simpleSale.sellerAddress, lucid)
    console.log(sellerAddress)

    const redeemer = Data.to("PBuy", MarketRedeemer)
    const tx = await lucid.newTx()
      .collectFrom([utxo], redeemer)
      .attachSpendingValidator(marketPlaceScript)
      .payToAddress(sellerAddress, { lovelace: simpleSale.priceOfAsset })
      .complete()

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  } 
})

test("Alice sells NFT 2", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  const bob = await provider.getJambhalaAddr("bob")
  const validatorAddress = lucid.utils.validatorToAddress(marketPlaceScript)
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("alice"))

  const { paymentCredential } = lucid.utils.getAddressDetails(bob)
  if (paymentCredential !== undefined) {  
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    // Alice offers 1 NFT for sale
    const tx = await lucid.newTx()
      .payToContract(validatorAddress, { 
          inline: Data.to({
            sellerAddress: fromAddress(await lucid.wallet.address()),
            priceOfAsset: 1_500_000n
          }, SimpleSale)
        }, { 
          [unit]: 1n
        })
      .complete()

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  }
})

test("Alice withdraws NFT", async () => {
  const provider = new LucidProviderFrontend("ws://localhost:1338")
  await provider.init()
  const lucid = await Lucid.new(provider, "Custom")

  const bob = await provider.getJambhalaAddr("bob")
  const validatorAddress = lucid.utils.validatorToAddress(marketPlaceScript)
  lucid.selectWalletFromPrivateKey(await provider.getJambhalaPrivKey("alice"))

  const { paymentCredential } = lucid.utils.getAddressDetails(bob)
  if (paymentCredential !== undefined) {  
    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "sig",
      keyHash: paymentCredential.hash
    })
    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy)
    const unit = policyId + fromText("BobToken")

    const utxos = await provider.getUtxosWithUnit(validatorAddress, unit)
    const utxo = utxos[0]
    console.log(JSON.stringify(utxo, null, 2))

    const simpleSale = Data.from(utxo.datum, SimpleSale)
    const sellerAddress = toAddress(simpleSale.sellerAddress, lucid)
    console.log("seller address=" + sellerAddress)

    console.log("lucid wallet address=" + await lucid.wallet.address())
    const redeemer = Data.to("PWithdraw", MarketRedeemer)
    const tx = await lucid.newTx()
      .collectFrom([utxo], redeemer)
      .attachSpendingValidator(marketPlaceScript)
      .addSigner(sellerAddress)
      .complete()

    const signedTx = await tx.sign().complete()
    const txHash = await signedTx.submit()
    await provider.waitBlock()
  } 
})
