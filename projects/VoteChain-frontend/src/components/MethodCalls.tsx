import { useState } from 'react'

interface MethodsCallInterface {
  methodFunction: () => Promise<void>
  text: string
}

const MethodsCall = ({ methodFunction, text }: MethodsCallInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const callMethodFunction = async () => {
    setLoading(true)
    await methodFunction
    setLoading(false)
  }

  return (
    <button className="btn m-2" onClick={callMethodFunction}>
      {loading ? <span className="loading loading-spinner" /> : text}
    </button>
  )
}
export default MethodsCall
