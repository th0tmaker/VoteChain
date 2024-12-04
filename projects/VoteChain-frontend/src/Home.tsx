// src/components/Home.tsx
import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import React, { useEffect, useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import { VoteChainClient } from './contracts/VoteChain'
import * as methods from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Interfaces for types
interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const { activeAddress, signer } = useWallet()
  const [creatorAddress, setCreatorAddress] = useState<string | null>(null)
  const [appClient, setAppClient] = useState<VoteChainClient | null>(null)
  const [appId, setAppId] = useState<bigint | null>(null)
  const [appAddr, setAppAddr] = useState<string>('')
  const [voteStartDateStr, setVoteStartDateStr] = useState<string>('')
  const [voteStartDateUnix, setVoteStartDateUnix] = useState<number>(0)
  const [voteEndDateStr, setVoteEndDateStr] = useState<string>('')
  const [voteEndDateUnix, setVoteEndDateUnix] = useState<number>(0)
  const [voteChoice, setVoteChoice] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  useEffect(() => {
    const fetchAppClient = async () => {
      const client = await handleCreateApp() // handleCreateApp is your async function
      if (client) {
        setAppClient(client) // Store the appClient in state
        setAppId(BigInt(client.appId)) // Update appId state
        setAppAddr(client.appAddress) // Update appAddr state
      }

      // client?.state.global.choice1VoteCount
    }

    fetchAppClient() // Call the async function
  }, []) // Empty dependency array ensures this effect runs once when the component mounts

  // Algorand client setup
  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })
  algorand.setDefaultSigner(signer)

  // Helper to validate vote dates
  const validateVoteDates = (startUnix: number, endUnix: number): string | null => {
    if (startUnix >= endUnix) return 'Start date must be earlier than end date.'
    if (endUnix - startUnix > 14 * 24 * 60 * 60) return 'Voting period cannot exceed 14 days.'
    return null
  }

  // Utility function for converting date strings to Unix
  const convertDateStringToUnix = (dateStr: string): number => {
    const [month, day, year] = dateStr.split('/')
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return Math.floor(date.getTime() / 1000)
  }

  // User Input Handler (Vote Dates)
  const handleVoteDatesInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const value = e.target.value
    const unixValue = convertDateStringToUnix(value)

    if (type === 'start') {
      setVoteStartDateStr(value)
      setVoteStartDateUnix(unixValue)
    } else if (type === 'end') {
      setVoteEndDateStr(value)
      setVoteEndDateUnix(unixValue)
    }
  }

  // User Input Handler (Vote Choice)
  const handleVoteChoiceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) // Convert string input to number
    if ([1, 2, 3].includes(value)) {
      setVoteChoice(BigInt(value)) // Valid value, set as bigint
    } else {
      alert('Invalid choice! Please enter 1, 2, or 3.')
    }
  }

  const handleCreateApp = async () => {
    if (!activeAddress) {
      alert('Please connect a wallet.')
      return null
    }

    // Check if the app is already initialized
    if (appId) {
      if (creatorAddress && activeAddress !== creatorAddress) {
        alert('Only the creator can initialize the app.')
      } else {
        alert('App has already been initialized.')
      }
      return null
    }

    try {
      // The first user initializes the app and becomes the creator
      const appClient = await methods.createApp(algorand, activeAddress)()
      setCreatorAddress(activeAddress)
      setAppId(BigInt(appClient.appId))
      setAppAddr(String(appClient.appAddress))
      alert(`App created successfully! App ID: ${appClient.appId}`)
      return appClient // Return the created appClient
    } catch (error) {
      alert('Error creating app!')
      return null // Return null in case of an error
    }
  }

  // Handle opt in to App
  const handleOptIn = async () => {
    if (!appId) {
      alert('App ID is not set. Please create or select an app first.')
      return
    }

    if (!activeAddress) {
      alert('Please connect a wallet.')
      return
    }

    try {
      await methods.optIn(algorand, appId, activeAddress)
      alert('Opt-in successful!')
    } catch (error) {
      alert('Error during opt-in.')
    }
  }

  // Handle opt out of App
  const handleOptOut = async () => {
    if (!appId) {
      alert('App ID is not set. Please create or select an app first.')
      return
    }

    if (!activeAddress) {
      alert('Please connect a wallet.')
      return
    }

    try {
      await methods.optOut(algorand, appId, activeAddress)
      alert('Opt-in successful!')
    } catch (error) {
      alert('Error during opt-in.')
    }
  }

  // Set vote dates
  const setVoteDates = async () => {
    const validationError = validateVoteDates(voteStartDateUnix, voteEndDateUnix)
    if (validationError) {
      alert(validationError)
      return
    }

    setIsLoading(true)

    try {
      if (!creatorAddress) {
        alert('Creator address is not set.')
        return
      }

      if (!appId) {
        alert('App ID is not initialized.')
        return
      }

      const setVoteDatesFn = methods.setVoteDates(
        algorand,
        appId,
        creatorAddress,
        voteStartDateStr,
        BigInt(voteStartDateUnix),
        voteEndDateStr,
        BigInt(voteEndDateUnix),
      )

      await setVoteDatesFn()
      alert('Vote dates successfully set!')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle opt out of App
  const handleCastVote = async () => {
    if (!appId) {
      alert('App ID is not set. Please create or select an app first.')
      return
    }

    if (!activeAddress) {
      alert('Please connect a wallet.')
      return
    }

    if (!voteChoice) {
      alert('No choice selected.')
      return
    }

    try {
      await methods.castVote(algorand, appId, activeAddress, voteChoice)
      alert('Vote submitted successfully!')
    } catch (error) {
      alert('Error during vote submission.')
    }
  }

  return (
    <div className="hero min-h-screen bg-slate-800">
      <div className="hero-content text-center rounded-lg p-6 max-w-md bg-blue-100">
        <div className="max-w-md">
          <h1 className="text-4xl">
            Welcome to <div className="font-bold">VoteChain</div>
          </h1>
          <p className="py-6">Bla bla bla paragraf.</p>

          <div className="grid">
            <button data-test-id="connect-wallet" className="btn m-2" onClick={toggleWalletModal}>
              Tekvin
            </button>
            <div className="divider" />
            <label className="label">App ID: {appId ? appId.toString() : 'Loading...'}</label>
            <label className="label">App Creator: {creatorAddress || 'Not available'}</label>
            <label className="label">App Address: {appAddr || 'Not available'}</label>
          </div>

          <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
          {/* <AppCalls openModal={appCallsDemoModal} setModalState={setAppCallsDemoModal} /> */}
        </div>
      </div>
    </div>
  )
}

export default Home
