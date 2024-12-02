import * as algokit from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { VoteChainClient, VoteChainFactory } from './contracts/VoteChain'

export function createApp(vcf: VoteChainFactory, sender: string, signer: TransactionSignerAccount, appId: (id: number) => void) {
  return async () => {
    const createAppTxn = await vcf.send.create.createApp({
      sender: sender,
      signer: signer,
      // staticFee: AlgoAmount.MicroAlgo(ALGORAND_MIN_TX_FEE),
      args: [], // No arguments for create_app()
    })

    appId(Number(createAppTxn.appClient.appId))
    return { createAppTxn }
  }
}

export function optInToLocalStorage(
  algorand: algokit.AlgorandClient,
  vcc: VoteChainClient,
  appAddress: string,
  sender: string,
  signer: TransactionSignerAccount,
) {
  return async () => {
    const mbrPay = await algorand.createTransaction.payment({
      sender: sender,
      receiver: appAddress,
      amount: algokit.algos(0.1 + 0.1 + 0.057),
      extraFee: algokit.algos(0.001),
    })

    await vcc.send.optIn.localStorage({
      sender: sender,
      signer: signer,
      args: {
        account: sender,
        mbrPay: mbrPay,
      },
    })
  }
}

// Usage example:
// const { createAppTxn } = await createApp(algorand, vcf, sender, signer)()
// await optInToLocalStorage(algorand, vcc, createAppTxn.appClient.appAddress, sender, signer)()

export function optOut(vcc: VoteChainClient, sender: string, signer: TransactionSignerAccount) {
  return async () => {
    await vcc.send.closeOut.optOut({
      sender: sender,
      signer: signer,
      args: {
        account: sender,
      },
    })
  }
}

export function setVoteDates(
  vcc: VoteChainClient,
  sender: string,
  signer: TransactionSignerAccount,
  voteStartDateStr: string,
  voteStartDateUnix: bigint,
  voteEndDateStr: string,
  voteEndDateUnix: bigint,
) {
  return async () => {
    await vcc.send.setVoteDates({
      sender: sender,
      signer: signer,
      args: {
        voteStartDateStr: voteStartDateStr,
        voteStartDateUnix: voteStartDateUnix,
        voteEndDateStr: voteEndDateStr,
        voteEndDateUnix: voteEndDateUnix,
      },
    })
  }
}

export function castVote(vcc: VoteChainClient, sender: string, signer: TransactionSignerAccount, choice: bigint) {
  return async () => {
    await vcc.send.castVote({
      sender: sender,
      signer: signer,
      args: {
        account: sender,
        choice: choice,
      },
    })
  }
}
