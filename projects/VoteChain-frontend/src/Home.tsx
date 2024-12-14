// src/components/Home.tsx

import * as algokit from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import React, { useEffect, useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import { VoteChainClient } from './contracts/VoteChain'
import * as methods from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Configure console logger
algokit.Config.configure({
  debug: true,
  logger: consoleLogger,
})

// Algorand client setup
const algodConfig = getAlgodConfigFromViteEnvironment()
const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })

// Interfaces for types
interface AppProps {
  appClient: VoteChainClient
  appId: bigint
  appAddr: string
  creatorAddress: string
} // define interface with the desired App properties

interface PollProps {
  title: string
  choices: string[]
  startDate: string
  endDate: string
} // define interface with the desired poll properties

const Home: React.FC = () => {
  // *STATE VARIABLES*
  // Wallet state variables
  const [openWalletModal, setOpenWalletModal] = useState(false) // set wallet open state to false
  const { activeAddress, signer } = useWallet() // extract the active address and signer objects from connected wallet

  // App client state variables
  const [appClient, setAppClient] = useState<VoteChainClient>() // set app creator address
  const [creatorAddress, setCreatorAddress] = useState<string>() // set app creator address
  const [appAddr, setAppAddr] = useState<string>() // set the app address
  const [appId, setAppId] = useState<bigint>() // set the app id

  // Store multiple app instances in an array
  const [apps, setApps] = useState<AppProps[]>([]) // Stores all created apps

  // Poll state variables hooked via PollProps interface
  const [pollParams, setPollParams] = useState<PollProps>({
    title: '',
    choices: ['', '', ''],
    startDate: '',
    endDate: '',
  })

  // Vote dates state variables
  const [voteStartDateStr, setVoteStartDateStr] = useState<string>('')
  const [voteStartDateUnix, setVoteStartDateUnix] = useState<number>(0)
  const [voteEndDateStr, setVoteEndDateStr] = useState<string>('')
  const [voteEndDateUnix, setVoteEndDateUnix] = useState<number>(0)

  // Vote choice state variable
  const [voteChoice, setVoteChoice] = useState<bigint | null>(null)

  // Boolean flags to track what screen is being rendered
  const [isHomeActive, setIsHomeActive] = useState(true) // track if home section should be rendered
  const [isPollActive, setIsPollActive] = useState(false) // track if poll section should be rendered
  const [isVotingActive, setIsVotingActive] = useState(false) // track if voting section should be rendered

  const [selectedChoice, setSelectedChoice] = useState('')

  const [userNotification, setUserNotification] = useState<string>('')
  const [startBtnPressed, setStartBtnPressed] = useState(false)
  // State variable for notification message and its styling
  const [notification, setNotification] = useState<string>('')
  const [notificationStyle, setNotificationStyle] = useState<string>('text-gray-800 font-bold ')

  const handleCreateApp = async () => {
    algorand.setDefaultSigner(signer)

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

      setAppClient(appClient)
      setCreatorAddress(activeAddress)
      setAppId(BigInt(appClient.appId))
      setAppAddr(String(appClient.appAddress))

      // alert(`App created successfully! App ID: ${appClient.appId}`)
      consoleLogger.info('Creator Address, App ID, App Address set!')
      consoleLogger.info('APP GLOBAL STATE: ', appClient.state.global)
      consoleLogger.info('APP GLOBAL STATE ACCOUNTS OPTED IN 1: ', appClient.state.global.totalAccountsOptedIn)

      await methods.optIn(algorand, activeAddress, BigInt(appClient.appId))

      await methods.setVoteDates(
        algorand,
        activeAddress,
        appClient.appId,
        voteStartDateStr,
        BigInt(voteStartDateUnix),
        voteEndDateStr,
        BigInt(voteEndDateUnix),
      )

      consoleLogger.info(activeAddress, 'has been successfully opted in.')
      consoleLogger.info('APP GLOBAL STATE: ', appClient.state.global)
      consoleLogger.info('ACTIVE ADDRESS LOCAL STATE: ', appClient.state.local(activeAddress))
      consoleLogger.info('APP GLOBAL STATE ACCOUNTS OPTED IN 2: ', appClient.state.global.totalAccountsOptedIn)

      return appClient
    } catch (error) {
      consoleLogger.error('Error creating app:', error)
      alert(`Error creating app: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  // *MANAGE LIFECYCLE SIDE EFFECTS*
  useEffect(() => {
    // App creation notification

    if (apps.length > 0) {
      consoleLogger.info('Current apps array:', apps)
      apps.map((app) => {
        // Log the appId and its global state together
        consoleLogger.info(`App ID: ${app.appId}, Global State:`, app.appClient.state.global.choice1VoteCount)
      })
      // setNotification('App created successfully!')
      // setNotificationStyle('text-green-500 font-bold')
    }

    // Poll dates notification (if needed)
    // Check if pollParams has all necessary fields
    if (pollParams.startDate && pollParams.endDate) {
      processVoteDates() // Process vote dates only if start and end dates are present
    }

    // Check for missing inputs
    if (!pollParams.title || !pollParams.choices || !pollParams.startDate || !pollParams.endDate) {
      setNotification('Missing inputs') // Show error to the user
      setNotificationStyle('text-red-700 font-bold') // Apply error style
      return
    } else {
      // If all inputs are present
      setNotification('All inputs are valid')
      setNotificationStyle('text-green-700 font-bold') // Apply success style
    }
  }, [activeAddress, apps, pollParams]) // dependency array ensures notifications are updated based on these changes

  // * BUTTON ON-CLICK EVENTS*
  // Toggle wallet state true or false (on/off)
  const toggleWalletModal = () => {
    setOpenWalletModal((prev) => !prev) // Toggle wallet modal

    if (activeAddress) {
      // Wallet is connected
      setNotification('Wallet connected successfully!')
      setNotificationStyle('text-green-700 font-bold')
    } else {
      // No wallet connected
      setNotification('')
      setNotificationStyle('')
    }
  }
  // Run when start button is clicked
  const handleStartClick = () => {
    if (!activeAddress) {
      // User presses Start without connecting wallet
      setNotification('Please connect a wallet before starting!')
      setNotificationStyle('text-red-700 font-bold')
    } else if (activeAddress) {
      // User has connected wallet and presses Start
      // setStartBtnPressed(true) // Set start button pressed to true
      setIsHomeActive(false)
      setIsPollActive(true) // Show poll section
      setNotification('')
      setNotificationStyle('')
    }
  }

  // Run when cancel button is clicked
  const handleCancelClick = () => {
    setPollParams({
      title: '',
      choices: ['', '', ''],
      startDate: '',
      endDate: '',
    })
    setIsHomeActive(true)
    setIsPollActive(false)

    if (activeAddress) {
      // Wallet is connected
      setNotification('Wallet connected successfully!')
      setNotificationStyle('text-green-700 font-bold')
    }
  }

  // *EVENT HANDLER METHODS*
  // Create the App client
  const createApp = async () => {
    try {
      if (!activeAddress) {
        consoleLogger.info('logger: Please connect a wallet!')
        return
      }

      // Set the Wallet signer object to default signer
      algorand.setDefaultSigner(signer)

      // Creating a new App instance by calling createApp in methods.ts
      const appClient = await methods.createApp(algorand, activeAddress)
      // const bla = algorand.client.algod.block(1)
      // const block = await algorand.client.algod.getBlockTxids(1).do()
      // const firstTxId = block.blockTxids[0] // Access the first transaction ID
      // consoleLogger.info('First Transaction ID:', firstTxId)
      // const txConfirmed = await algosdk.waitForConfirmation(algorand.client.algod, firstTxId, 1)
      // consoleLogger.info('TX CONFIRMED: ', txConfirmed)

      // Set up properties for the new App client
      const newApp: AppProps = {
        appClient: appClient, // Store the appClient itself
        appId: BigInt(appClient.appId),
        appAddr: appClient.appAddress,
        creatorAddress: activeAddress,
      }

      // Log details for the newly created app
      consoleLogger.info('App Client:', newApp.appClient)
      consoleLogger.info('App ID:', BigInt(newApp.appId).toString())
      consoleLogger.info('App Address:', newApp.appAddr)
      consoleLogger.info('Creator Address:', newApp.creatorAddress)

      // Add the new App client to the existing array of Apps
      setApps((prevApps) => [...prevApps, newApp])

      consoleLogger.info('New app created and added to apps list:', newApp)

      // Now you can access appClient and its state for the new app
      // const choice1VoteCount = await appClient.state.global.choice1VoteCount()
      // consoleLogger.info('Choice 1 Vote Count:', choice1VoteCount)

      // Wait for the app creation transaction to be completed, then set vote dates
      // await setVoteDates(newApp) // Pass the newApp to set vote dates
    } catch (error) {
      consoleLogger.error('Error creating app:', error)
      alert(`Error creating app: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Handle Creator Opt in to App client
  const handleCreatorOptIn = async (appId: bigint) => {
    try {
      await methods.optIn(algorand, activeAddress!, appId)
      alert('Opt-in successful!')
      consoleLogger.info('logger: Opt-in successful for: ', activeAddress)
    } catch (error) {
      alert('Error during opt-in.')
    }
  }

  // Function to handle selecting an app for opt-in
  const handleSelectApp = (selectedAppId: bigint) => {
    const selectedApp = apps.find((app) => app.appId === selectedAppId)
    if (selectedApp) {
      setAppId(selectedApp.appId) // Set the selected appId for the opt-in
      setAppAddr(selectedApp.appAddr) // Set the app address
      setCreatorAddress(selectedApp.creatorAddress) // Set the creator address
    } else {
      alert('App not found!')
    }
  }

  const submitVote = async () => {
    setIsVotingActive(false) // Exit voting screen
    setIsHomeActive(true)
  }

  const handlePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Wait for the createApp function to complete
      //await createApp()
      handleCreateApp()
      // Log success or update UI flags accordingly
      setIsPollActive(false)
      setIsVotingActive(true)
      setNotification('Vote dates successfully set!')
      setNotificationStyle('text-green-700 font-bold')
    } catch (error) {
      consoleLogger.error('Error submitting poll:', error)
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Create a function to format the dates into correct string format
  const formatVoteDateString = (dateStr: string): string => {
    const [month, day, year] = dateStr.split('-') // Expected input: "MM-DD-YYYY"
    return `${month}/${day}/${year}` // Expected output: "MM/DD/YYYY"
  }

  const processVoteDates = () => {
    // Convert date strings to Unix timestamps
    const startDateUnix = convertVoteDateToUnix(pollParams.startDate)
    const endDateUnix = convertVoteDateToUnix(pollParams.endDate)

    // Validate the vote dates
    const validationError = validateVoteDates(startDateUnix, endDateUnix)
    if (validationError !== 'vote dates valid!') {
      setNotification(validationError) // Show error to user
      setNotificationStyle('text-red-700 font-bold')
      return
    } else {
      setNotification('')
      setNotificationStyle('')
    }

    // Assign to state variables if valid
    setVoteStartDateStr(formatVoteDateString(pollParams.startDate))
    setVoteStartDateUnix(startDateUnix)
    setVoteEndDateStr(formatVoteDateString(pollParams.endDate))
    setVoteEndDateUnix(endDateUnix)
  }

  // HELPER to validate vote dates
  const validateVoteDates = (startUnix: number, endUnix: number): string => {
    const maxVotePeriod = 14 * 24 * 60 * 60 // Max vote period in seconds (14 days)
    if (startUnix > endUnix) {
      return 'Invalid dates! Start date must be earlier than end date.'
    }
    if (endUnix - startUnix > maxVotePeriod) {
      return 'Invalid dates! Voting period must not exceed a maximum of 14 days.'
    }
    return 'vote dates valid!'
  }

  // HELPER function for converting date strings to Unix
  const convertVoteDateToUnix = (dateStr: string): number => {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return Math.floor(date.getTime() / 1000)
  }

  const isPollValid = () => {
    const { title, choices, startDate, endDate } = pollParams

    // Ensure all fields are populated
    if (!title || choices.some((choice) => !choice) || !startDate || !endDate) {
      return false // One or more fields are incomplete
    }

    // Ensure start date is before end date and within the valid range
    const startUnix = convertVoteDateToUnix(startDate)
    const endUnix = convertVoteDateToUnix(endDate)

    const validationMessage = validateVoteDates(startUnix, endUnix)
    if (validationMessage !== 'vote dates valid!') {
      consoleLogger.warn(validationMessage) // Log the validation failure message
      return false // Return false if the validation fails
    }

    return true // Return true if the poll is valid
  }

  // Handle non-Creator Opt in to App
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

  // Set vote dates method
  const setVoteDates = async (newApp: AppProps) => {
    try {
      const { appId, creatorAddress } = newApp

      if (!creatorAddress) {
        alert('Creator address is missing for the selected app.')
        return
      }

      if (!appId) {
        alert('App ID is missing for the selected app.')
        return
      }

      // Set vote dates transaction
      const setVoteDatesFn = methods.setVoteDates(
        algorand,
        creatorAddress,
        appId,
        voteStartDateStr,
        BigInt(voteStartDateUnix),
        voteEndDateStr,
        BigInt(voteEndDateUnix),
      )

      // Await the setVoteDates function
      await setVoteDatesFn

      consoleLogger.info('Vote dates successfully set for app ID:', appId)
      alert('Vote dates successfully set!')
    } catch (error) {
      consoleLogger.error('Error setting vote dates:', error)
      alert(`Error setting vote dates: ${error instanceof Error ? error.message : String(error)}`)
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

  const getBorderClass = (date: string) => {
    if (date === pollParams.startDate || date === pollParams.endDate) {
      const { startDate, endDate } = pollParams

      if (!startDate || !endDate) {
        return 'border-2 border-red-500' // Dates are missing
      }

      const startUnix = convertVoteDateToUnix(startDate)
      const endUnix = convertVoteDateToUnix(endDate)

      const validationMessage = validateVoteDates(startUnix, endUnix)
      return validationMessage === 'vote dates valid!' ? 'border-2 border-green-500' : 'border-2 border-red-500' // Valid or invalid dates
    }

    return 'border-2 border-gray-300' // Default for other fields
  }

  return (
    <div className="hero min-h-screen bg-slate-800">
      <div className="hero-content maxl text-center rounded-lg p-10 max-w-full bg-blue-100">
        <div className="max-w-full">
          <h1 className="pb-4 text-[56px] font-bold">Welcome to VoteChain</h1>

          <p className={`mb-6 text-[20px] ${notificationStyle}`}>{notification}</p>

          {isHomeActive && !isPollActive && !isVotingActive && (
            // Start Section (Initially visible)
            <div className="grid justify-center">
              <button
                data-test-id="start-app-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={handleStartClick}
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
          )}

          {isPollActive && !isVotingActive && (
            // Poll Form Section (Visible when creating poll)
            <div>
              <div className="mt-2 max-w-2xl mx-auto">
                <form onSubmit={handlePollSubmit} className="space-y-2 bg-white p-4 rounded-lg shadow-lgb border-2 border-black">
                  <h2 className="text-2xl font-bold text-center mb-2">Create New Poll</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Poll Title</label>
                      <input
                        type="text"
                        value={pollParams.title}
                        onChange={(e) => setPollParams({ ...pollParams, title: e.target.value })}
                        className={`w-full p-3 border rounded-md focus:outline-none ${pollParams.title ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Choices (3 required)</label>
                      {pollParams.choices.map((choice, index) => (
                        <input
                          key={index}
                          type="text"
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...pollParams.choices]
                            newChoices[index] = e.target.value
                            setPollParams({ ...pollParams, choices: newChoices })
                          }}
                          placeholder={`Choice ${index + 1}`}
                          className={`w-full p-3 border rounded-md focus:outline-none ${pollParams.choices[index] ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                          required
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={pollParams.startDate}
                          onChange={(e) => setPollParams({ ...pollParams, startDate: e.target.value })}
                          className={`w-full p-3 border rounded-md focus:outline-none ${getBorderClass(pollParams.startDate)}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={pollParams.endDate}
                          onChange={(e) => setPollParams({ ...pollParams, endDate: e.target.value })}
                          className={`w-full p-3 border rounded-md focus:outline-none ${getBorderClass(pollParams.endDate)}`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 justify-center mt-6 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-red-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-red-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isPollValid()} // Disable if the poll is invalid
                      className={`btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold m-2 ${
                        isPollValid()
                          ? 'bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700'
                          : 'bg-gray-400 border-[3px] border-gray-600 cursor-not-allowed'
                      }`}
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {!isPollActive && isVotingActive && (
            // Voting Active section
            <div className="voting-section mt-4 p-6 bg-white rounded-lg shadow-lg border-2 border-black max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-4">Vote Now</h2>

              <div className="space-y-4">
                <p className="text-lg font-medium text-gray-800">
                  Poll Title: <span className="text-green-700">{pollParams.title}</span>
                </p>

                <div>
                  <p className="text-md font-semibold mb-2">Choices:</p>
                  <ul className="space-y-2">
                    {pollParams.choices.map((choice, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <input
                          type="radio"
                          id={`choice-${index}`}
                          name="vote"
                          value={choice}
                          className="form-radio h-5 w-5 text-green-500"
                          onChange={(e) => setSelectedChoice(e.target.value)} // Track the selected choice
                        />
                        <label htmlFor={`choice-${index}`} className="text-gray-800">
                          {choice || `Choice ${index + 1}`}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={submitVote} // Function to handle vote submission
                  className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                >
                  Submit Vote
                </button>
                <button
                  onClick={() => setIsVotingActive(false)} // Exit the voting screen
                  className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-red-500 border-[3px] border-black hover:border-[4px] hover:border-red-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isVotingActive && (
            // App Details Section
            <div className="mt-4">
              <div className="text-left justify-items-start">
                <div>
                  <span className="text-black text-[18px] font-bold italic">App ID: </span>
                  <span className="text-green-800 text-[18px] font-bold">{appId ? appId.toString() : 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-black text-[18px] font-bold italic">App Creator: </span>
                  <span className="text-green-800 text-[18px] font-bold">{creatorAddress}</span>
                </div>
                <div>
                  <span className="text-black text-[18px] font-bold italic">App Address: </span>
                  <span className="text-green-800 text-[18px] font-bold">{appAddr}</span>
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
