import { ethereum, log, Address } from "@graphprotocol/graph-ts"
import { Safe } from "../../../../generated/templates"
import { KNOWN_SERVICE_SAFES } from "./constants"

/**
 * Bootstrap handler to create Safe datasource instances for existing services
 * 
 * WHY HARDCODED APPROACH IS NECESSARY:
 * 
 * 1. **Event History Gaps**: Service registry events may be missed during subgraph bootstrap,
 *    especially for services created before the subgraph deployment block.
 * 
 * 2. **Retroactive Tracking**: Historical services need ETH balance tracking from their
 *    creation, not just from when the subgraph started indexing.
 * 
 * 3. **Dynamic Discovery Limitations**: AssemblyScript/The Graph limitations make it
 *    difficult to iterate over all Service entities efficiently during bootstrap.
 * 
 * 4. **Reliability**: Hardcoded list ensures all critical service safes are tracked
 *    regardless of indexing issues or missed events.
 * 
 * ALTERNATIVE APPROACHES CONSIDERED:
 * - Dynamic discovery via Service entity iteration (AssemblyScript limitations)
 * - Event-based discovery only (misses historical services)
 * - External service to populate list (adds complexity)
 * 
 * The hardcoded approach is the most reliable for ensuring complete ETH balance tracking.
 */
export function handleSafeBootstrap(block: ethereum.Block): void {
  log.info("SAFE BOOTSTRAP: Starting Safe datasource creation for existing services at block {}", [
    block.number.toString()
  ])
  
  let count = 0
  for (let i = 0; i < KNOWN_SERVICE_SAFES.length; i++) {
    let safeAddress = KNOWN_SERVICE_SAFES[i]
    
    // Create Safe datasource instance for ETH balance tracking
    Safe.create(Address.fromString(safeAddress))
    count = count + 1
    
    log.info("SAFE BOOTSTRAP: Created Safe datasource for service safe: {}", [safeAddress])
  }
  
  log.info("SAFE BOOTSTRAP: Completed - created {} Safe datasource instances", [count.toString()])
}
