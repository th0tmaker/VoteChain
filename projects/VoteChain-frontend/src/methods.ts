import { AlgorandClient, algos } from '@algorandfoundation/algokit-utils'
import { VoteChainFactory } from './contracts/VoteChain'

// For initial app creation
export function createApp(algorand: AlgorandClient, creator: string) {
  return async () => {
    const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

    // Create the initial app
    const result = await factory.send.create.createApp({
      sender: creator,
      signer: algorand.account.getSigner(creator),
      args: [], // No arguments for create_app()
    })

    // // Extract app ID and address from the creation result
    // const appId = Number(createResult.appClient.appId)
    // const appAddr = String(createResult.appClient.appAddress)

    // // Update the app ID and address using the provided callback functions
    // setAppId(appId)
    // setAppAddr(appAddr)

    // Return the app client for further interactions
    return result.appClient
  }
}

// For other users to connect to existing app
export async function optIn(algorand: AlgorandClient, appId: bigint, sender: string) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

  // Get the app client by ID
  const client = factory.getAppClientById({ appId: appId })

  // Create the Minimum Balance Requirement (MBR) payment transaction
  const mbrPay = await algorand.createTransaction.payment({
    sender: sender,
    receiver: client.appAddress,
    amount: algos(0.1 + 0.1 + 0.057),
    extraFee: algos(0.001),
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

export function optOut(algorand: AlgorandClient, appId: bigint, sender: string) {
  return async () => {
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
}

export function setVoteDates(
  algorand: AlgorandClient,
  appId: bigint,
  creator: string,
  voteStartDateStr: string,
  voteStartDateUnix: bigint,
  voteEndDateStr: string,
  voteEndDateUnix: bigint,
) {
  return async () => {
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
}

export function castVote(algorand: AlgorandClient, appId: bigint, sender: string, choice: bigint) {
  return async () => {
    const factory = algorand.client.getTypedAppFactory(VoteChainFactory)

    // Get the app client by ID
    const client = factory.getAppClientById({ appId })

    // Send the opt-out transaction
    await client.send.castVote({
      sender: sender,
      signer: algorand.account.getSigner(sender),
      args: {
        account: sender,
        choice: choice,
      },
    })
  }
}
