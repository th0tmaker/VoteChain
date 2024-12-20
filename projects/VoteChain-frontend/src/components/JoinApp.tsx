import { useWallet } from '@txnlab/use-wallet'
import { useState } from 'react'
import { AppProps, JoinAppInterface } from '../types' // Import the interfaces

const JoinApp = <T extends AppProps>({ openModal, closeModal, apps, onAppJoin, getAppId }: JoinAppInterface<T>) => {
  const { activeAddress } = useWallet()
  const [appId, setAppId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleJoinApp = () => {
    try {
      const inputAppId = BigInt(appId)
      if (apps && apps.length > 0) {
        const matchingApp = apps.find((app) => getAppId(app) === inputAppId)
        if (!matchingApp) {
          setErrorMessage('No app with that App ID. Please try again.')
          return
        }
        setErrorMessage(null)
        onAppJoin(matchingApp)
      } else {
        setErrorMessage(`No client with App ID: ${inputAppId}`)
      }
    } catch (error) {
      setErrorMessage('Invalid App ID format. Please enter a valid ID number.')
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
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
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
