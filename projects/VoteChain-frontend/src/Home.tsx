// src/components/Home.tsx
import * as algokit from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import { VoteChainClient } from './contracts/VoteChain'
import * as methods from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Configure logger globally
algokit.Config.configure({
  debug: true,
  logger: consoleLogger,
})

interface PollForm {
  title: string
  choices: string[]
  startDate: string
  endDate: string
}

// Interfaces for types
interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const { activeAddress, signer } = useWallet()
  const [creatorAddress, setCreatorAddress] = useState<string>()
  const [appClient, setAppClient] = useState<VoteChainClient | null>(null)
  const [appId, setAppId] = useState<bigint | null>(null)
  const [appAddr, setAppAddr] = useState<string>('')
  const [voteStartDateStr, setVoteStartDateStr] = useState<string>('')
  const [voteStartDateUnix, setVoteStartDateUnix] = useState<number>(0)
  const [voteEndDateStr, setVoteEndDateStr] = useState<string>('')
  const [voteEndDateUnix, setVoteEndDateUnix] = useState<number>(0)
  const [voteChoice, setVoteChoice] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isStarted, appIsStarted] = useState(false) // To track if the "Start" button has been clicked
  const [isPollFormActive, setIsPollFormActive] = useState(false)
  const [pollDetails, setPollDetails] = useState<PollForm>({
    title: '',
    choices: ['', '', ''],
    startDate: '',
    endDate: '',
  })

  const handleMakePoll = () => {
    setIsPollFormActive(true)
  }

  const handlePollSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsPollFormActive(false)
    // Here you'll add the logic to submit to your smart contract

    handleVoteDatesInput
    handleVoteChoiceInput
  }

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  // useEffect(() => {
  //   const fetchAppClient = async () => {
  //     // Only proceed if we have an active address
  //     if (activeAddress) {
  //       consoleLogger.info('Attempting to create app with address:', activeAddress)
  //       const client = await handleCreateApp()
  //       if (client) {
  //         setAppClient(client)
  //         setAppId(BigInt(client.appId))
  //         setAppAddr(client.appAddress)
  //         consoleLogger.info('App client successfully initialized')
  //       }
  //     }
  //   }

  //   fetchAppClient()
  // }, [activeAddress]) // Add activeAddress as a dependency

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
    try {
      consoleLogger.info('Current activeAddress:', activeAddress) // Add this line
      if (!activeAddress) {
        consoleLogger.error('No active address found')
        alert('Please connect a wallet!')
        return null
      }

      consoleLogger.info('Creating app with address:', activeAddress)

      // The first user initializes the app and becomes the creator
      const appClient = await methods.createApp(algorand, activeAddress)

      consoleLogger.info('App created successfully:', appClient)

      setCreatorAddress(activeAddress)
      setAppId(BigInt(appClient.appId))
      setAppAddr(String(appClient.appAddress))

      // alert(`App created successfully! App ID: ${appClient.appId}`)
      consoleLogger.info('Creator Address, App ID, App Address set!')
      appIsStarted(true) // Set started state to true, triggering grid change

      await methods.optIn(algorand, activeAddress, BigInt(appClient.appId))

      consoleLogger.info(activeAddress, 'has been successfully opted in.')

      return appClient
    } catch (error) {
      consoleLogger.error('Error creating app:', error)
      alert(`Error creating app: ${error instanceof Error ? error.message : String(error)}`)
      return null
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
      await methods.optIn(algorand, activeAddress, appId)
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
      await methods.optOut(algorand, activeAddress, appId)
      alert('Opt-out successful!')
    } catch (error) {
      alert('Error during opt-out.')
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
        creatorAddress,
        appId,
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

  // Handle vote submission
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
      await methods.castVote(algorand, activeAddress, appId, voteChoice)
      alert('Vote submitted successfully!')
    } catch (error) {
      alert('Error during vote submission.')
    }
  }

  return (
    <div className="hero min-h-screen bg-slate-800">
      <div className="hero-content maxl text-center rounded-lg p-10 max-w-full bg-blue-100">
        <div className="max-w-full">
          <h1 className="text-5xl font-bold">Welcome to VoteChain</h1>
          <p className="py-6 text-lg">Bla bla bla paragraph with a larger font size and more space.</p>
          {!isStarted ? (
            <div className="grid justify-center">
              <button
                data-test-id="start-app-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={handleCreateApp}
              >
                Start
              </button>
              <button
                data-test-id="join-app-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
              >
                Join
              </button>
              <button
                data-test-id="connect-wallet-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={toggleWalletModal}
              >
                Tekvin
              </button>
              <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
            </div>
          ) : (
            <div>
              <div className="mt-2 max-w-2xl mx-auto">
                <form onSubmit={handlePollSubmit} className="space-y-2 bg-white p-4 rounded-lg shadow-lgb border-2 border-black">
                  <h2 className="text-2xl font-bold text-center mb-2">Create New Poll</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Poll Title</label>
                      <input
                        type="text"
                        value={pollDetails.title}
                        onChange={(e) => setPollDetails({ ...pollDetails, title: e.target.value })}
                        className={`w-full p-3 border rounded-md focus: outline-none
                          ${pollDetails.title ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Choices (3 required)</label>
                      {pollDetails.choices.map((choice, index) => (
                        <input
                          key={index}
                          type="text"
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...pollDetails.choices]
                            newChoices[index] = e.target.value
                            setPollDetails({ ...pollDetails, choices: newChoices })
                          }}
                          placeholder={`Choice ${index + 1}`}
                          className={`w-full p-3 border rounded-md focus: outline-none
                            ${pollDetails.choices[index] ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                          required
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={pollDetails.startDate}
                          onChange={(e) => setPollDetails({ ...pollDetails, startDate: e.target.value })}
                          className={`w-full p-3 border rounded-md focus: outline-none
                            ${pollDetails.startDate ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={pollDetails.endDate}
                          onChange={(e) => setPollDetails({ ...pollDetails, endDate: e.target.value })}
                          className={`w-full p-3 border rounded-md focus: outline-none
                            ${pollDetails.endDate ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setPollDetails({
                          title: '',
                          choices: ['', '', ''],
                          startDate: '',
                          endDate: '',
                        })
                        setIsPollFormActive(false) // Set the poll form to inactive
                        appIsStarted(false) // Set the app to not started
                      }}
                      className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-red-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-red-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                      onClick={handlePollSubmit}
                    >
                      Create
                    </button>
                  </div>
                </form>

                {/* App Details Section */}
                <div className="mt-4">
                  <div className="text-left justify-items-start">
                    <div className="">
                      <span className="text-black text-[18px] font-bold italic">App ID: </span>
                      <span className="text-green-800 text-[18px] font-bold">{appId ? appId.toString() : 'Loading...'}</span>
                    </div>
                    <div className="">
                      <span className="text-black text-[18px] font-bold italic">App Creator: </span>
                      <span className="text-green-800 text-[18px] font-bold">{creatorAddress}</span>
                    </div>
                    <div className="">
                      <span className="text-black text-[18px] font-bold italic">App Address: </span>
                      <span className="text-green-800 text-[18px] font-bold">{appAddr}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Home
