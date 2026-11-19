export interface DemoFirearmAllocation {
  id: string
  guardId: string
  guardName: string
  firearmId: string
  firearmSerialNumber: string
  firearmModel: string
  allocationDate: string
  returnDate?: string
  status: 'active' | 'returned'
}

// The SPA keeps this data through an account switch. A new document starts empty.
let allocations: DemoFirearmAllocation[] = []

export function getDemoFirearmAllocations(): DemoFirearmAllocation[] {
  return allocations
}

export function getGuardDemoFirearmAllocations(guardId: string): DemoFirearmAllocation[] {
  return allocations.filter((row) => row.guardId === guardId)
}

export function addDemoFirearmAllocation(allocation: DemoFirearmAllocation): DemoFirearmAllocation[] {
  if (allocations.some((row) => row.firearmId === allocation.firearmId && row.status === 'active')) {
    return allocations
  }
  allocations = [allocation, ...allocations]
  return allocations
}

export function returnDemoFirearmAllocation(id: string): DemoFirearmAllocation[] {
  const returnDate = new Date().toISOString()
  allocations = allocations.map((row) => row.id === id && row.status === 'active'
    ? { ...row, status: 'returned', returnDate }
    : row)
  return allocations
}
