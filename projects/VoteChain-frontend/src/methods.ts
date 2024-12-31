//src/methods.ts

import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import { VoteChainFactory } from './contracts/VoteChain'

// Use Algorand client to get typed factory object which will be used to create or deploy the desired smart contract App
export function getFactory(algorand: AlgorandClient, creator: string) {
  // Pass your AppFactory object w/ creator as the default sender and signer
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory, {
    defaultSender: creator,
    defaultSigner: algorand.account.getSigner(creator),
  })

  // Return the created factory object
  return factory
}

// Use Factory to send a 'create' abimethod transaction which will generate a new instance of the smart contract App client
export async function createApp(algorand: AlgorandClient, creator: string) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Generate new App client via factory
  const { appClient } = await factory.send.create.generate({
    sender: creator,
    signer: algorand.account.getSigner(creator),
    args: [], // No args for create.generate() required
  })

  // Return the App client for further interactions
  return appClient
}

// App creator pays MBR cost for global state usage
export async function payGlobalMbrCost(alogrand: AlgorandClient, creator: string, appId: bigint) {
  // Get App Factory
  const factory = alogrand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // Create Global Schema MBR payment transaction
  const mbrPay = await alogrand.createTransaction.payment({
    sender: creator,
    receiver: client.appAddress,
    amount: algo(0.1 + 0.1 + 0.428),
    extraFee: algo(0.001),
  })

  // Call the client 'global_storage_mbr' abimethod w/ creator as sender and signer
  await client.send.globalStorageMbr({
    sender: creator,
    signer: alogrand.account.getSigner(creator),
    args: {
      mbrPay: mbrPay, // pass the MBR payment transaction
    },
  })
}

// User opts in to local storage and pays MBR cost
export async function optIn(algorand: AlgorandClient, sender: string, appId: bigint) {
  // Get App Factory
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // Create Local Schema MBR payment transaction
  const mbrPay = await algorand.createTransaction.payment({
    sender: sender,
    receiver: client.appAddress,
    amount: algo(0.1 + 0.1 + 0.057),
    extraFee: algo(0.001),
  })

  // Call the client 'local_storage_mbr' abimethod w/ user as sender and signer
  await client.send.optIn.localStorageMbr({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender, // sender is the account opting in
      mbrPay: mbrPay, // pass the MBR payment transaction
    },
  })
}

// User opts out of local storage and gets MBR cost refunded
export async function optOut(algorand: AlgorandClient, sender: string, appId: bigint) {
  // Get App Factory
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // Call the client 'out_out' close out abimethod w/ user as sender and signer
  await client.send.closeOut.optOut({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender, // sender is the account opting out
    },
  })
}

// Creator sets up poll
export async function setupPoll(
  algorand: AlgorandClient,
  creator: string,
  appId: bigint,
  title: string,
  choice1: string,
  choice2: string,
  choice3: string,
  startDateStr: string,
  startDateUnix: bigint,
  endDateStr: string,
  endDateUnix: bigint,
) {
  // Get App Factory
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // Call the client 'set_vote_dates' abimethod w/ creator as sender and signer
  await client.send.setupPoll({
    sender: creator,
    signer: algorand.account.getSigner(creator),
    args: {
      title: new TextEncoder().encode(title),
      choice1: new TextEncoder().encode(choice1),
      choice2: new TextEncoder().encode(choice2),
      choice3: new TextEncoder().encode(choice3),
      startDateStr: startDateStr,
      startDateUnix: startDateUnix,
      endDateStr: endDateStr,
      endDateUnix: endDateUnix,
    },
  })
}

// User submits vote
export async function submitVote(algorand: AlgorandClient, sender: string, appId: bigint, choice: bigint) {
  // Get App Factory
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // Call the client 'submit_vote' abimethod w/ user as sender and signer
  await client.send.submitVote({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender, // sender is the account submitting the vote
      choice: choice, // choice is passed as arg on call
    },
  })
}

// Creator deletes the smart contract App instance
export async function deleteApp(algorand: AlgorandClient, creator: string, appId: bigint) {
  // Get App Factory
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get App client through factory by passing client App ID
  const client = factory.getAppClientById({ appId })

  // await client.send.clearState({
  //   sender: creator,
  //   signer: algorand.account.getSigner(creator),
  //   // Optional parameters if needed:
  //   // note: new Uint8Array([...]),
  //   // maxFee: microAlgos(2000),
  // })

  // Call the client delete application abimethod w/ creator as sender and signer
  await client.appClient.send.delete({
    sender: creator,
    signer: algorand.account.getSigner(creator),
    method: 'terminate',
  })
}
