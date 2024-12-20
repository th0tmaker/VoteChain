//src/methods.ts

import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import { VoteChainFactory } from './contracts/VoteChain'

// Function to initialize factory with creator
export function getFactory(algorand: AlgorandClient, creator: string) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory, {
    defaultSender: creator,
  })

  return factory
}

// For initial app creation
export async function createApp(algorand: AlgorandClient, creator: string) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Create the initial app
  const { appClient } = await factory.send.create.createApp({
    sender: creator,
    signer: algorand.account.getSigner(creator),
    args: [], // No arguments for create_app()
  })

  // Return the app client for further interactions
  return appClient
}

// For other users to connect to existing app
export async function optIn(algorand: AlgorandClient, sender: string, appId: bigint) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get the app client by ID
  const client = factory.getAppClientById({ appId: appId })

  // Create the Minimum Balance Requirement (MBR) payment transaction
  const mbrPay = await algorand.createTransaction.payment({
    sender: sender,
    receiver: client.appAddress,
    amount: algo(0.1 + 0.1 + 0.057),
    extraFee: algo(0.001),
  })

  // Opt-in to local storage
  await client.send.optIn.localStorage({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender,
      mbrPay: mbrPay,
    },
  })
}

export async function optOut(algorand: AlgorandClient, sender: string, appId: bigint) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get the app client by ID
  const client = factory.getAppClientById({ appId })

  // Send the opt-out transaction
  await client.send.closeOut.optOut({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender,
    },
  })
}

export async function setVoteDates(
  algorand: AlgorandClient,
  creator: string,
  appId: bigint,
  voteStartDateStr: string,
  voteStartDateUnix: bigint,
  voteEndDateStr: string,
  voteEndDateUnix: bigint,
) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get the app client by ID
  const client = factory.getAppClientById({ appId })

  // Send the setVoteDates transaction
  await client.send.setVoteDates({
    sender: creator,
    signer: algorand.account.getSigner(creator),
    args: {
      voteStartDateStr,
      voteStartDateUnix,
      voteEndDateStr,
      voteEndDateUnix,
    },
  })
}

export async function submitVote(algorand: AlgorandClient, sender: string, appId: bigint, choice: bigint) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get the app client by ID
  const client = factory.getAppClientById({ appId })

  // Send the opt-out transaction
  await client.send.submitVote({
    sender: sender,
    signer: algorand.account.getSigner(sender),
    args: {
      account: sender,
      choice: choice,
    },
  })
}
