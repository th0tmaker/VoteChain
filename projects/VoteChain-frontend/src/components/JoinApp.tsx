import { useWallet } from '@txnlab/use-wallet'
import { useState } from 'react'
import { JoinAppInterface } from '../types'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'

const JoinApp = ({ algorand, openModal, closeModal, onAppJoin }: JoinAppInterface) => {
  const { activeAddress } = useWallet()
  const [userInputAppId, setUserInputAppId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleJoinApp = async () => {
    try {
      // Convert user input to a valid App ID (BigInt -> Number)
      const appId = BigInt(userInputAppId)

      // Fetch app details from Algorand using the provided App ID
      const result = await algorand.client.algod.getApplicationByID(Number(appId)).do()

      if (!result) {
        setErrorMessage('No app with that App ID found on the blockchain. Please try again.')
        return
      }

      // If successful, clear the error message and invoke onAppJoin with the fetched details
      setErrorMessage(null)
      onAppJoin(appId) // Pass the appId forward
    } catch (error) {
      // Handle errors, such as invalid ID format or fetch failure
      consoleLogger.error('Error fetching App ID:', error)
      setErrorMessage('Failed to fetch app details. Please ensure the App ID is correct.')
    }
  }

  return (
    <dialog id="join_app_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box">
        <h3 className="text-2xl font-bold">Join Existing App Client</h3>
        <p className="mt-4 -mb-2">Provide App ID to join an existing poll and vote</p>
        <div className="grid m-2 pt-5">
          {activeAddress ? (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Enter App ID"
                value={userInputAppId}
                onChange={(e) => setUserInputAppId(e.target.value)}
                className="input input-bordered"
              />
              <button type="button" className="btn text-black hover:text-white hover:bg-green-700" onClick={handleJoinApp}>
                Join
              </button>
              {errorMessage && <p className="text-red-700 font-bold">{errorMessage}</p>}
            </div>
          ) : (
            <p className="text-center text-red-700 font-bold">Please connect a wallet before starting</p>
          )}
        </div>
        <div className="modal-action">
          <button
            data-test-id="close-wallet-modal"
            className="btn btn-warning"
            onClick={() => {
              setErrorMessage('') // Clear the error message
              closeModal() // Close the modal
            }}
          >
            Close
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default JoinApp
