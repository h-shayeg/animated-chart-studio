import { Component, type ReactNode } from 'react'

interface ChartBoundaryProps {
  // The boundary draws its children again whenever this value changes.
  resetKey: unknown
  title: string
  children: ReactNode
}

interface ChartBoundaryState {
  error: Error | null
  key: unknown
}

// A chart that cannot be drawn must not take the whole page down with it.
export class ChartBoundary extends Component<ChartBoundaryProps, ChartBoundaryState> {
  override state: ChartBoundaryState = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<ChartBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(
    props: ChartBoundaryProps,
    state: ChartBoundaryState,
  ): Partial<ChartBoundaryState> | null {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey }
  }

  override render() {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <div
        role="alert"
        className="grid min-h-40 flex-1 place-items-center px-6 text-center text-rose-600 dark:text-rose-400"
      >
        <div className="space-y-2">
          <p className="font-semibold">{this.props.title}</p>
          <p dir="ltr" className="text-sm break-words opacity-80">
            {error.message}
          </p>
        </div>
      </div>
    )
  }
}
