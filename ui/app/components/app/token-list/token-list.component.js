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

  useEffect(() => {
    if (tokenTracker.prev) {
      if (
        isEqual(tokens, tokenTracker.prev.tokens) &&
        userAddress === tokenTracker.prev.userAddress &&
        network === tokenTracker.prev.network
      ) {
        return
      }
    }
    tokenTracker.prev = { tokens, network, userAddress }

    const cleanup = () => {
      const { showError, tracker, updateBalances } = tokenTracker
      if (tracker) {
        tracker.stop()
        tracker.removeListener('update', updateBalances)
        tracker.removeListener('error', showError)
      }
    }

    cleanup()
    setTokensLoading(true)

    if (!tokens || !tokens.length || !userAddress || network === 'loading' || !global.ethereumProvider) {
      return
    }

    // Set up listener instances for cleaning up
    tokenTracker.updateBalances = (tokensWithBalances) => {
      setTokensWithBalances(tokensWithBalances)
      if (error) {
        setError(null)
      }
      setTokensLoading(false)
    }
    tokenTracker.showError = (error) => {
      setError(error)
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

    return cleanup
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
