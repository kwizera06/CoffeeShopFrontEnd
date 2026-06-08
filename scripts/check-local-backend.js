/**
 * Verifies the correct Coffee Shop Node API is reachable before starting the web app.
 * Port 8080 is often occupied by a different Java app on this machine.
 */
const API = process.env.VITE_API_URL || 'http://localhost:8081'

async function main() {
  try {
    const res = await fetch(`${API.replace(/\/$/, '')}/`)
    const body = await res.json()
    if (body?.message?.includes('Olitech Coffee Shop API')) {
      console.log(`OK: Coffee Shop API is running at ${API}`)
      process.exit(0)
    }
    console.error(`WRONG API at ${API}:`, body)
    console.error('Expected Olitech Coffee Shop Node backend. Start it: cd CoffeeManagement_Backend && npm start')
    process.exit(1)
  } catch (e) {
    console.error(`Cannot reach ${API}:`, e.message)
    console.error('Start backend: cd CoffeeManagement_Backend && npm start')
    process.exit(1)
  }
}

main()
