//src/types.ts

import { VoteChainClient } from './contracts/VoteChain'

// Interfaces for types
export interface AppProps {
  appClient: VoteChainClient
  creatorAddress: string
  poll: PollProps
  // accountsOptedIn: string[]
} // define interface with the desired App properties

export interface PollProps {
  title: string
  choices: string[]
  startDate: string
  endDate: string
} // define interface with the desired poll properties

export interface JoinAppInterface<T> {
  openModal: boolean
  closeModal: () => void
  apps: T[]
  onAppJoin: (app: T) => void
  getAppId: (app: T) => bigint
}
