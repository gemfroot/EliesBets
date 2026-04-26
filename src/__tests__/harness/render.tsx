import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "@/components/Toast";

/** Wraps the component under test in the providers it actually consumes
 *  during a chain-switch / claim flow. Keep this tiny — anything heavier
 *  belongs in a test-local mock. */
export function renderWithProviders(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}
