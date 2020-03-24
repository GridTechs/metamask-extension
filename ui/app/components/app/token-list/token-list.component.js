import React, { useContext, useEffect, useRef, useState } from 'react'
import TokenCell from '../token-cell'
import TokenTracker from 'eth-token-tracker'
import { useSelector } from 'react-redux'
import { isEqual } from 'lodash'
import { I18nContext } from '../../../contexts/i18n'
import { getSelectedAddress } from '../../../selectors/selectors'
import contracts from 'eth-contract-metadata'

const defaultTokens = []
for (const address in contracts) {
  const contract = contracts[address]
  if (contract.erc20) {
    contract.address = address
    defaultTokens.push(contract)
  }
}

const TokenList = () => {
  const [tokensWithBalances, setTokensWithBalances] = useState([])
  const [error, setError] = useState(null)
  const network = useSelector((state) => state.metamask.network)
  const [tokensLoading, setTokensLoading] = useState()
  // use `isEqual` comparison function because the token array is serialized from the background
  // so it has a new reference with each background update, even if the tokens haven't changed
  const tokens = useSelector((state) => state.metamask.tokens, isEqual)
  const userAddress = useSelector(getSelectedAddress)

  const t = useContext(I18nContext)
  const assetImages = useSelector((state) => state.metamask.assetImages)

  const tokenTrackerRef = useRef({})
  const tokenTracker = tokenTrackerRef.current


  const cleanup = () => {
    const { showError, tracker, updateBalances } = tokenTracker
    if (tracker) {
      console.log('CLEANUP')
      tracker.stop()
      tracker.removeListener('update', updateBalances)
      tracker.removeListener('error', showError)
    }
  }

  const constructTokenTracker = () => {
    if (!tokens || !tokens.length) {
      setTokensWithBalances([])
      setTokensLoading(false)
      return
    }
    setTokensLoading(true)

    if (!userAddress || network === 'loading' || !global.ethereumProvider) {
      console.log('LOADING')
      return
    } else {
      console.log('BUILDING')
    }

    tokenTracker.updateBalances = (tokensWithBalances) => {
      setTokensWithBalances(tokensWithBalances)
      if (error) {
        setError(null)
      }
      console.log('UPDATED')
      setTokensLoading(false)
    }
    tokenTracker.showError = (error) => {
      setError(error)
      console.log('ERROR')
      setTokensLoading(false)
    }

    tokenTracker.tracker = new TokenTracker({
      userAddress,
      provider: global.ethereumProvider,
      tokens: tokens,
      pollingInterval: 8000,
    })
    tokenTracker.tracker.on('update', tokenTracker.updateBalances)
    tokenTracker.tracker.on('error', tokenTracker.showError)
    tokenTracker.tracker.updateBalances()
  }

  // initial tracker setup and final teardown
  useEffect(() => {
    constructTokenTracker()
    return cleanup
  }, []) // only execute this effect on mount

  // rebuild tracker as needed
  useEffect(() => {
    if (!tokenTracker.prev) {
      tokenTracker.prev = { tokens, network, userAddress }
      return
    }
    if (
      isEqual(tokens, tokenTracker.prev.tokens) &&
      userAddress === tokenTracker.prev.userAddress &&
      network === tokenTracker.prev.network
    ) {
      return
    }
    tokenTracker.prev = { tokens, network, userAddress }

    cleanup()
    constructTokenTracker()
  }, [network, tokens, userAddress])

  if (network === 'loading' || tokensLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '250px',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
        }}
      >
        {t('loadingTokens')}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="hotFix"
        style={{
          padding: '80px',
        }}
      >
        {t('troubleTokenBalances')}
        <span
          className="hotFix"
          style={{
            color: 'rgba(247, 134, 28, 1)',
            cursor: 'pointer',
          }}
          onClick={() => {
            global.platform.openWindow({
              url: `https://ethplorer.io/address/${userAddress}`,
            })
          }}
        >
          {t('here')}
        </span>
      </div>
    )
  }

  return (
    <div>
      {tokensWithBalances.map((tokenData, index) => {
        tokenData.image = assetImages[tokenData.address]
        return (
          <TokenCell key={index} {...tokenData} />
        )
      })}
    </div>
  )
}

export default TokenList
