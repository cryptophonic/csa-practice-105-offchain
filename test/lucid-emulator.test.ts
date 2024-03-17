// sum.test.js
import { describe, it, expect, test } from "vitest";
import fc from "fast-check";
import { sum } from "../src/sum.js";
import {
  Assets,
  Data,
  Emulator,
  Lucid,
  Script,
  fromText,
  generateSeedPhrase,
} from "@anastasia-labs/lucid-cardano-fork";
import { MarketRedeemer, SimpleSale } from "../src/contract-schema.js";
import { fromAddress, toAddress } from "../src/utils.js";
import script from "./marketplace.json";
import { Constr } from "@anastasia-labs/lucid-cardano-fork";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});

console.log("testing");

export const generateAccountSeedPhrase = async (assets: Assets) => {
  const seedPhrase = generateSeedPhrase();
  return {
    seedPhrase,
    address: await (await Lucid.new(undefined, "Custom"))
      .selectWalletFromSeed(seedPhrase)
      .wallet.address(),
    assets,
  };
};

console.log(await generateAccountSeedPhrase({ lovelace: 10_000_000n }));

test("Alice sells NFT, Bob buys NFT", async () => {
  const policyid = "88dc7cd1c28d3a0c7ef4df99036c7c9688d309d91a1bb6fe4b08fee9";
  const myToken = fromText("myToken");
  const unit = policyid + myToken;
  const user1 = await generateAccountSeedPhrase({
    lovelace: 10_000_000n,
  });
  const user2 = await generateAccountSeedPhrase({
    lovelace: 30_000_000n,
    [unit]: 70n,
  });
  const emulator = new Emulator([user1, user2]);
  const lucid = await Lucid.new(emulator);

  lucid.selectWalletFromSeed(user1.seedPhrase);
  console.log(await lucid.wallet.getUtxos());

  lucid.selectWalletFromSeed(user2.seedPhrase);
  console.log(await lucid.wallet.getUtxos());

  const tx = await lucid
    .newTx()
    .payToAddress(user1.address, { lovelace: 5_000_000n, [unit]: 5n })
    .complete();
  const signedTx = await tx.sign().complete();
  const txHash = await signedTx.submit();
  console.log(txHash);

  emulator.awaitBlock(10);

  lucid.selectWalletFromSeed(user1.seedPhrase);
  console.log("user1 utxos : ", await lucid.wallet.getUtxos());

  const datum = Data.to(
    { sellerAddress: fromAddress(user2.address), priceOfAsset: 5_000_000n },
    SimpleSale
  );
  console.log("SimpleSale datum as cbor", datum);
  // const mydatum = new Constr (0, [
  //   Constr 0 [ "pukhash"],
  //   Constr 0 [
  //     Constro 0 [
  //       "stakehash"
  //     ]
  //   ]
  // ]
  //   121_0([_
  //     121_0([_ -> address
  //         121_0([_
  //             h'ad2eac5b83ee132d92f33fefc9cfc265430db6fc4a001110c7407995', -> pubkeyhash
  //         ]),
  //         121_0([_
  //             121_0([_
  //                 121_0([_
  //                     h'09a3a2c68cc405fc5656a77eb89460a91f24a775c86ba8039ea70b75', -> stakehash
  //                 ]),
  //             ]),
  //         ]),
  //     ]),
  //     5000000_2, -> _2 _3
  // ])
  console.log(
    "user address as schema",
    JSON.stringify(fromAddress(user2.address))
  );

  const buy = Data.to("PBuy", MarketRedeemer);
  console.log("buy", buy);
  // d87980 == 121_0([]) == Constr 0 [] == PBuy
  const withdraw = Data.to("PWithdraw", MarketRedeemer);
  console.log("withdraw", withdraw);
  // d87a80 == 122_0([]) == Constr 1 [] == PWithdraw

  // CDDL
  // plutus_data =
  //   constr<plutus_data>
  // / { * plutus_data => plutus_data }
  // / [ * plutus_data ]
  // / big_int
  // / bounded_bytes

  // constr<a> =
  //   #6.121([* a]) -> Constr 0 [...]
  // / #6.122([* a]) -> Constr 1 [...]
  // / #6.123([* a]) ...
  // / #6.124([* a]) ...
  // / #6.125([* a])
  // / #6.126([* a])
  // / #6.127([* a])
  // ; similarly for tag range: 6.1280 .. 6.1400 inclusive
  // / #6.102([uint, [* a]])

  // Plutus
  // Constr Integer [Data]
  // Map [(Data, Data)]
  // List [Data]
  // I Integer
  // B ByteString
  const rawdatumCBOR =
    "d8799fd8799fd8799f581cad2eac5b83ee132d92f33fefc9cfc265430db6fc4a001110c7407995ffd8799fd8799fd8799f581c09a3a2c68cc405fc5656a77eb89460a91f24a775c86ba8039ea70b75ffffffff1a004c4b40ff";
  const datumSample = Data.from(rawdatumCBOR, SimpleSale);
  console.log("priceOfAsset ", datumSample.priceOfAsset);
  console.log("sellerAddress ", datumSample.sellerAddress);
  console.log(
    "sellerAddress as bech32 :",
    toAddress(datumSample.sellerAddress, lucid)
  );

  // Homework

  //1. Alice locks 1 NFT -> MarketPlace Contract
  //2. Bob fetch all utxos from MarketPlace contract
  //3. Bob picks 1 utxo
  //4. Build tx with
  //   - Collect the utxo
  //   - convert the raw datum to simpleSale schema
  //   - we get the price of the asset and the address "sellerAddress"
  //   - convert "sellerAddress" to sellerAddress as bech32
  //   - pay to Alice
  //   - attach market contract, attach the redeemer "PBuy"

  // const txSell = await lucid.newTx().payToContract().complete();

  // sign .. submit .. awaitblock

  //BOB fetching the contract address
  // pick one element
  // lucid.utxosAt()

  // const txBuy = await lucid.newTx().collectFrom().payToAddress().complete();

  const marketplace: Script = {
    type: "PlutusV2",
    script: script.cborHex,
  };
  const marketplaceAddr = lucid.utils.validatorToAddress(marketplace);
  console.log("marketplaceAddr :", marketplaceAddr);
});

test("Alice sell, Alice Withdraw", () => {
  // emulator
  // users with assets
  // tx to sell
  // tx to withdraw
});

test("property test", () => {
  // console.log(fc.bigIntN(2));
  console.log(fc.bigInt())
});

// Code under test
const contains = (text, pattern) => text.indexOf(pattern) >= 0;

// Properties
describe('properties', () => {
  // string text always contains itself
  it('should always contain itself', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        return contains(text, text);
      }),
    );
  });

  // string a + b + c always contains b, whatever the values of a, b and c
  it('should always contain its substrings', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (a, b, c) => {
        // Alternatively: no return statement and direct usage of expect or assert
        return contains(a + b + c, b);
      }),
    );
  });
});