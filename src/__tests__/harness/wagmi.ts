import { vi } from "vitest";

/** Address most tests use; convenient single source of truth. */
export const TEST_ADDRESS = "0x1111111111111111111111111111111111111111" as const;

export function makeConnection(over: Partial<{
  address: `0x${string}` | undefined;
  isConnected: boolean;
}> = {}) {
  return {
    address: TEST_ADDRESS,
    isConnected: true,
    connector: { id: "injected", name: "Injected" },
    ...over,
  };
}

/** Spy you can pass into `vi.mock` for `useQueryClient`. Gives you the
 *  invalidateQueries call without setting up a real QueryClientProvider. */
export function makeQueryClient() {
  return {
    invalidateQueries: vi.fn(async () => {}),
    refetchQueries: vi.fn(async () => {}),
    cancelQueries: vi.fn(async () => {}),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
  };
}
