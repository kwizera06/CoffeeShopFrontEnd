import { useEffect } from 'react'
import { useShopContext } from '../shop/ShopContext'

/**
 * usePageTitle Hook
 * Sets the document title to: "Page Title | Shop Name | Olitech Hub"
 * 
 * Usage:
 *   usePageTitle('Overview')
 *   // Sets: "Overview | Inganji Coffee Shop | Olitech Hub"
 */
export function usePageTitle(pageTitle) {
  const { context } = useShopContext()
  const shopName = context?.name || 'Olitech Hub'

  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} | ${shopName} | Olitech Hub`
    } else {
      document.title = `${shopName} | Olitech Hub`
    }
  }, [pageTitle, shopName])
}
