import { useEffect } from 'react'
import { AppProps } from '../types'
import { formatVoteDateStrOnChainnn } from '../utils/dates'

export const AppInfo = ({
  app,
  setUserMsg,
}: {
  app: AppProps | null
  setUserMsg: (notification: { msg: string; style: string }) => void
}) => {
  useEffect(() => {
    if (!app) {
      // Set the notification for validation failure
      setUserMsg({
        msg: 'App ID not found',
        style: 'text-red-700 font-bold',
      })
    } else {
      // Set the notification for success
      setUserMsg({
        msg: `Successfully loaded client with App ID: ${app.appClient.appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    }
  }, [app, setUserMsg]) // Ensure the effect runs when `app` changes

  if (!app) {
    return null // Avoid rendering if no app is found
  }

  return (
    <div className="mt-4">
      <div className="text-left justify-items-start">
        <div>
          <span className="text-black text-[18px] font-bold italic">App ID: </span>
          <span className="text-green-800 text-[18px] font-bold">{app.appClient.appId.toString()}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Address: </span>
          <span className="text-green-800 text-[18px] font-bold">{app.appClient.appAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Creator: </span>
          <span className="text-green-800 text-[18px] font-bold">{app.creatorAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote Start Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{formatVoteDateStrOnChainnn(app.poll.startDate)}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote End Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{formatVoteDateStrOnChainnn(app.poll.endDate)}</span>
        </div>
      </div>
    </div>
  )
}
