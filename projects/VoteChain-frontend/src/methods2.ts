import { algo, AlgorandClient } from '@algorandfoundation/algokit-utils'
import { VoteChainFactory } from './contracts/VoteChain'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Initialize Algorand client from config
const algodConfig = getAlgodConfigFromViteEnvironment()
const algorand = AlgorandClient.fromConfig({ algodConfig })

// Function to initialize factory with creator
export function getFactory(creator: string) {
  const factory = algorand.client.getTypedAppFactory(VoteChainFactory, {
    defaultSender: creator,
  })

  return factory
}

// Deploy App
export async function deployApp(creator: string) {
  const factory = getFactory(creator)
  const { appClient } = await factory.deploy({})
  return appClient
}

// For other users to connect to existing app
export async function optIn(creator: string, sender: string, appId: bigint) {
  const factory = getFactory(creator)
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

export function optOut(creator: string, sender: string, appId: bigint) {
  return async () => {
    const factory = getFactory(creator)
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
  creator: string,
  appId: bigint,
  voteStartDateStr: string,
  voteStartDateUnix: bigint,
  voteEndDateStr: string,
  voteEndDateUnix: bigint,
) {
  return async () => {
    const factory = getFactory(creator)
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

export function castVote(creator: string, sender: string, appId: bigint, choice: bigint) {
  return async () => {
    const factory = getFactory(creator)
    const client = factory.getAppClientById({ appId })

    // Send the cast vote transaction
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
